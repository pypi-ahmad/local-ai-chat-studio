# Local AI Chat Studio: Zero-to-Hero Study Handbook

> Verified against repository version **v0.2.0 on 2026-07-23**. Status markers: **[v2]** FastAPI/React v2, **[legacy]** Streamlit application, **[shared]** repository-wide tooling or concepts, and **[gap]** designed or displayed but not wired end to end.

This handbook takes a beginner from “what is an LLM?” to making a focused contribution. It is intentionally honest about the transition in this repository: the v2 backend is functional, but the v2 React app is mostly a visual shell. The legacy Streamlit application still contains the rich chat, files, RAG, memory, personalization, assistant, and comparison behavior.

Today, the legacy Streamlit path is the complete local end-user application; v2 is not yet end to end, and neither stack is production deployment-ready as shipped because the repository does not include authentication or hardened network deployment controls.

## 1. Start with the product boundary

Local AI Chat Studio is a local-first interface for chatting with models served by Ollama or optional bring-your-own-key (BYOK) cloud providers.

| Capability | Status | What exists now |
|---|---|---|
| FastAPI health, conversations, messages | [v2] | Working REST routes backed by `data/v2/studio.db` by default. |
| Provider credentials and discovery | [v2] | Session-scoped in-memory vault, environment fallback, seven adapters, concurrent discovery. |
| Streaming model runs | [v2] | In-memory run manager, provider dispatch, cancellation, replayable SSE events. |
| OpenRouter authorization | [v2] | PKCE start, callback, and manual-completion routes; verifier and resulting key remain in process memory. |
| React workspace | [v2] [gap] | Polished navigation and static/demo content; buttons and composer do not yet drive real conversations or runs. |
| TypeScript API layer | [v2] [gap] | Generated schema plus `createRun`, `cancelRun`, and `providers` client primitives; no UI integration or SSE client. |
| Rich chat, attachments, RAG, memory | [legacy] | Implemented in Streamlit and `src/`; not ported to v2 contracts. |
| Assistants and model comparison | [legacy] | Implemented; v2 screens are placeholders. |
| Shared v2/legacy persistence | [gap] | They use different SQLite schemas and default locations; there is no migration or synchronization. |
| v2 durable run history | [gap] | A `runs` table is created, but `RunManager` keeps runs only in memory and does not use it. |
| Authentication/multi-user authorization | [gap] | A browser-session cookie scopes keys, but it is not user authentication. Bind to localhost. |

The safest mental model is **two applications in one repository during a parity migration**, not one UI with two equivalent implementations.

## 2. Foundations: the ideas behind the code

### 2.1 LLMs, tokens, context, and temperature

An **LLM** (large language model) predicts the next token from prior tokens. A **token** is a model-specific text unit: sometimes a word, often part of a word, punctuation, or whitespace. Token counts determine context usage, latency, and often cloud cost.

The **context window** is the maximum token budget available to the request and generated answer. Chat history, system instructions, retrieved documents, and the answer all compete for this budget. The legacy orchestrator therefore selects recent history and bounded retrieval results instead of injecting everything.

**Temperature** controls sampling variability. Lower values usually make output more repeatable; higher values allow more varied choices. It is not a truth or creativity switch. [v2] `RunCreate.temperature` accepts `0..2` and defaults to `0.7`; adapters pass it to providers. [legacy] settings also default to `0.7`.

### 2.2 Embeddings, cosine similarity, vector databases, and RAG

An **embedding** maps text to a numeric vector whose direction represents semantic meaning. Similar ideas should have nearby vectors even when they use different words.

**Cosine similarity** compares vector direction:

```text
cosine(a, b) = (a · b) / (||a|| ||b||)
```

It ranges theoretically from `-1` to `1`; larger values mean more similar directions. Chroma may return a distance, so [legacy] `src/rag.py::_flatten` converts distance to `similarity = 1 - distance`.

A **vector database** stores embeddings plus source text and metadata, then performs nearest-neighbor search. [legacy] ChromaDB persists document chunks, prior chat turns, and memories under `data/chroma`.

**RAG** (retrieval-augmented generation) means: index source text, embed a question, retrieve relevant chunks, and add them to the model request. Retrieval does not train the model and does not guarantee correctness; it supplies evidence inside the current context.

### 2.3 BYOK, SPA, REST, SSE, and PKCE

- **BYOK** means “bring your own key.” Keys entered into this app are used to call the selected external provider.
- A **SPA** (single-page application) loads one browser application and changes views client-side. [v2] React is the SPA; Vite builds it into static files.
- **REST** uses HTTP resources and verbs. [v2] examples include `POST /api/v1/conversations` and `DELETE /api/v1/runs/{run_id}`.
- **SSE** (Server-Sent Events) is a one-way HTTP stream from server to browser. [v2] run events use `text/event-stream`, with named events such as `run.delta`. It is simpler than WebSockets when only server-to-client updates are needed.
- **PKCE** protects an authorization-code exchange with a one-time secret verifier. [v2] creates a verifier, sends its SHA-256 challenge to OpenRouter, and presents the verifier when exchanging the returned code. The current implementation stores one pending verifier per session.

### 2.4 Persistence and concurrency

**Persistence** survives process restart. SQLite conversations do; in-memory credentials and v2 runs do not. Chroma persists legacy vectors separately.

**Concurrency** means work overlaps. Relevant examples:

- [v2] `asyncio.gather` discovers provider models concurrently.
- [v2] each run is an `asyncio` task; events wake consumers through `asyncio.Event`.
- [v2] `threading.RLock` protects shared run, credential, and SQLite state accessed across threads.
- [legacy] daemon threads stream generation while Streamlit reruns its UI script.

Locks make individual critical sections safe, not entire workflows atomic. The legacy and v2 stores both calculate ordering while holding a lock and transaction. Neither architecture is currently designed for multiple server processes sharing its in-memory state.

## 3. Install and run

### 3.1 Prerequisites

- Python 3.12 or newer and [uv](https://docs.astral.sh/uv/).
- Node.js and npm for the v2 React build.
- [Ollama](https://ollama.com/download) plus a chat model for local inference.
- `ollama pull embeddinggemma` for legacy memory/RAG.
- Optional LibreOffice or `antiword` for legacy `.doc` parsing.

### 3.2 Windows PowerShell

```powershell
git clone https://github.com/pypi-ahmad/local-ai-chat-studio.git
Set-Location local-ai-chat-studio
uv sync --locked --dev

Set-Location frontend
npm ci
npm run build
Set-Location ..

uv run chat-studio
```

Open `http://127.0.0.1:8000`. For frontend development, keep the backend running and use a second PowerShell window:

```powershell
Set-Location frontend
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. Run the legacy application with:

```powershell
ollama pull embeddinggemma
uv run streamlit run app.py
```

Stop either server with `Ctrl+C` in its terminal.

### 3.3 POSIX shells

```bash
git clone https://github.com/pypi-ahmad/local-ai-chat-studio.git
cd local-ai-chat-studio
uv sync --locked --dev

cd frontend
npm ci
npm run build
cd ..

uv run chat-studio
```

In another terminal, use `cd frontend && npm run dev` for Vite development. Use `ollama pull embeddinggemma && uv run streamlit run app.py` for the legacy app.

### 3.4 Configuration and data

| Setting | v2 effect | Legacy effect |
|---|---|---|
| `CHAT_DATA_DIR` | Base for `studio.db`; default relative `data/v2`. | Pydantic `data_dir`; default repository `data`. |
| `CHAT_OLLAMA_HOST` | Ollama adapter host. | Ollama client endpoint default. |
| Provider key variables | Session-vault fallback. | Process-memory vault fallback. |
| `.env` | No explicit v2 settings loader. | Loaded by Pydantic settings. |

Provider variables are `OLLAMA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, and [v2] `OMNIROUTE_API_KEY`. Never commit them.

## 4. Repository map

```text
backend/app/             [v2] FastAPI routes, contracts, store, sessions, providers, runs, CLI
frontend/src/            [v2] React shell, styles, UI primitives, API client/schema
scripts/                 [shared] OpenAPI-to-TypeScript generator
tests/                   [v2] API and provider contract tests
app.py                   [legacy] Streamlit chat entry point
pages/                   [legacy] Memory, Settings, Providers, Compare pages
src/                     [legacy] jobs, orchestration, providers, files, RAG, memory, persistence
.github/workflows/ci.yml [shared] backend and frontend CI jobs
data/                    runtime data; ignored, not source
docs/tutorial/           generated/interactive learning companion when present
```

Suggested reading order: `backend/app/contracts.py` → `store.py` → `sessions.py` → `providers.py` → `runs.py` → `main.py` → `frontend/src/api/` → `App.tsx`; then study `app.py` → `src/jobs.py` → `src/orchestrator.py` and the legacy feature modules.

## 5. FastAPI v2, module by module

### 5.1 `backend/app/main.py`: composition and HTTP contracts

`create_app(database_url=None, provider_registry=None)` is the composition root. Dependency injection of a database path and provider registry makes tests deterministic. It constructs one `Store`, `SessionVault`, `ProviderRegistry`, and `RunManager`, exposes them on `app.state`, and closes SQLite during lifespan shutdown.

The middleware reads `chat_session` or generates a random ID, adds it to `request.state`, and sets an `HttpOnly`, `SameSite=Strict`, non-secure cookie. This scopes credentials but does not prove user identity.

| Method and path | Contract | Behavior |
|---|---|---|
| `GET /api/v1/health` | object | Health/version probe. |
| `POST /api/v1/conversations` | `ConversationCreate → Conversation` | Creates a conversation, status 201. |
| `GET /api/v1/conversations` | `Conversation[]` | Lists newest-updated first, without messages. |
| `GET /api/v1/conversations/{id}` | `Conversation` | Returns messages ordered by position; 404 if absent. |
| `POST /api/v1/conversations/{id}/messages` | `MessageCreate → Message` | Appends a message, status 201. |
| `GET /api/v1/providers` | provider summaries | Reports `session`, `env`, or no key source. |
| `GET /api/v1/providers/models` | discovery map | Concurrent discovery; failure is isolated per provider. |
| `PUT/DELETE /api/v1/providers/{id}/credential` | 204 | Sets/removes the current session value. |
| `POST /api/v1/providers/openrouter/auth/start` | URLs | Starts PKCE. |
| `GET .../auth/callback`, `POST .../auth/complete` | redirect/204 | Exchanges code and stores key. |
| `POST /api/v1/runs` | `RunCreate → RunSnapshot` | Queues async work, status 202. |
| `GET /api/v1/runs/{id}` | snapshot | Reads current in-memory state. |
| `GET /api/v1/runs/{id}/events` | SSE | Replays existing events and waits for new ones until terminal. |
| `DELETE /api/v1/runs/{id}` | snapshot | Requests cooperative cancellation. |

After routes are registered, FastAPI mounts `frontend/dist` at `/` only if that directory exists. In development, Vite serves the SPA instead. API routes must remain registered before the catch-all static mount.

### 5.2 `contracts.py`: one source for request/response shapes

Pydantic validates roles, required text, title length, temperature, and run status. `RunSnapshot` represents lifecycle state; `RunEvent` represents an occurrence. Mutable defaults appear as `[]`/`{}` in models, but Pydantic copies model defaults per instance.

`conversation_id` exists on `RunCreate`, but [gap] the v2 run path does not persist prompts or output into that conversation.

### 5.3 `store.py`: SQLite and ordering

The v2 schema has `conversations`, `messages`, and `runs`. Foreign keys cascade message deletion, though [gap] there is no delete-conversation route. `Store.add_message` verifies the conversation, computes `MAX(position)+1`, inserts, and updates the conversation timestamp under one re-entrant lock and transaction.

The `runs` table is currently unused. Actual `RunState` objects live in `RunManager._runs`, so restart loses them.

### 5.4 `sessions.py`: credential isolation

`SessionVault` stores `{session_id: {provider: key}}` in memory. `get` prefers a session value and falls back to the provider environment variable. `source` reveals only where a key came from, not its value. There is no expiry or cleanup of session dictionaries yet.

### 5.5 `providers.py`: normalized adapters

Every adapter implements `list_models(api_key)` and async `stream(api_key, model, messages, temperature)`. The registry contains Ollama, OpenAI, Anthropic, Gemini, OpenRouter, xAI, and OmniRoute.

- OpenAI, OpenRouter, xAI, and OmniRoute share `OpenAICompatibleAdapter` with different base URLs.
- Ollama uses `CHAT_OLLAMA_HOST` and an optional bearer key.
- Anthropic separates system messages and caps output at 4096 tokens.
- Gemini currently flattens the normalized message list into a labeled text prompt.
- Model discovery catches each adapter error and returns it in `ProviderDiscovery` rather than failing the whole response.

### 5.6 `runs.py`: lifecycle, events, and cancellation

`create` immediately stores a queued snapshot and schedules `_execute`. Execution emits:

```text
queued → running → completed
                 ↘ cancelled
                 ↘ failed
events: run.started, zero or more run.delta, then one terminal event
```

The built-in `echo` provider exists only as a deterministic contract-test path. Cancellation is cooperative: `DELETE` sets a threading event; status changes only when the streaming loop next observes it. A provider stalled before yielding cannot be interrupted immediately.

SSE framing in `main.py` is:

```text
event: run.delta
data: {"type":"run.delta", ...}

```

### 5.7 `cli.py` and static serving

The `chat-studio` console script invokes Uvicorn on `127.0.0.1:8000`, without reload. Build `frontend/dist` before production-style local use. The loopback host is an intentional safety boundary; changing it to `0.0.0.0` exposes an unauthenticated service.

## 6. React v2: shell, client, schema, and gaps

`frontend/src/App.tsx` renders a navigation rail, sample conversation history, a chat composer, provider cards, and generic workspace placeholders. State switches pages and fills prompt suggestions. It uses React and local shadcn/Base UI-style components.

What it does **not** currently do:

- [gap] load/create conversations or persist messages;
- [gap] discover models or configure credentials;
- [gap] submit the composer to `createRun`;
- [gap] consume SSE deltas or display actual responses;
- [gap] cancel active runs, upload files, use RAG/memory, compare models, or manage assistants;
- [gap] derive its “Backend connected” indicator from `/health`.

`frontend/src/api/client.ts` contains only `createRun`, `cancelRun`, and `providers`. Its shared request helper sends JSON and same-origin cookies. There is no EventSource/fetch-stream implementation and no conversation client methods.

`frontend/src/api/schema.ts` is generated by `scripts/generate_api_types.py` from FastAPI OpenAPI. Do not hand-edit it. The generator covers the repository’s current simple schemas; it is not a general OpenAPI generator.

## 7. Legacy Streamlit: where feature-rich behavior lives

### 7.1 `app.py` and pages

`app.py` is the chat UI and integration shell. It initializes state, builds a unified model catalog, persists the user turn, starts a background job, polls live output, and offers conversation/message actions.

- `pages/1_Memory.py`: inspect, pin, edit, archive, delete memories and rebuild the profile.
- `pages/2_Settings.py`: generation/features, assistants, export/import, clearing, and panic wipe.
- `pages/3_Providers.py`: keys, endpoint configuration, testing, model discovery, and OpenRouter flow.
- `pages/4_Compare.py`: two parallel ephemeral runs; results are not chat history.

Streamlit reruns the script after interactions. `st.session_state` retains browser-session UI state, while `src/jobs.py` keeps generation alive outside a single rerun.

### 7.2 `src/jobs.py` and `src/orchestrator.py`

`jobs.start` creates a process-global `Job` and daemon thread. `_run` parses attachments, optionally searches the web, assembles context, dispatches streaming, updates visible text, persists the assistant response, then performs best-effort title/index/memory/profile work.

`orchestrator.build_messages` layers:

1. base/custom system instruction;
2. personalization profile;
3. relevant durable memories;
4. cross-chat retrieval hits;
5. current-conversation document hits;
6. direct attachment/OCR/web context;
7. recent history.

`after_turn_indexing` embeds a completed exchange for later cross-chat recall.

### 7.3 Catalog, providers, and Ollama

`src/catalog.py` merges Ollama `ModelInfo` and cloud `ApiModel` records into `SelectedModel` keys such as `ollama::<name>` and `<provider>::<id>`. It groups models and chooses a coding-model candidate heuristically.

`src/providers.py` implements the legacy provider key vault, model listing, streaming, connection tests, and older OpenRouter authorization helpers. `src/ollama_client.py` centralizes endpoint-aware model discovery, chat/generate calls, embeddings, image description, running-model health, and capability selection.

These modules are not imported by the v2 provider stack; similar concepts are currently duplicated.

### 7.4 Files and RAG

`src/files.py` recognizes PDFs, Word documents, spreadsheets, text/code, and images. `parse_upload` returns an `Attachment`; `chunk_text` creates overlapping text windows. Legacy `.doc` extraction shells out to LibreOffice or `antiword` when available.

In `jobs._process_attachments`, small extracted documents fit directly into prompt context. Large documents are chunked and indexed through `src/rag.py`. Vision-capable models can receive image bytes; text-only targets may use a local vision fallback to describe the image.

`src/rag.py` owns three Chroma collections: document chunks, chat history, and memories. Metadata maintains conversation/document identity. Retrieval is scoped appropriately, including excluding the active conversation from cross-chat recall.

### 7.5 Memory and personalization

`src/memory.py` asks a local helper model to extract durable facts, parses a JSON list, rejects near-duplicates using embedding similarity, and stores accepted facts in SQLite plus Chroma. Relevant memories are touched when used; old unpinned memories can decay to archived state.

`src/personalization.py` stores a prose profile in legacy SQLite key/value state. It rebuilds periodically from user messages and rated assistant samples. Memory means atomic facts; profile means a synthesized description of preferences and expertise.

### 7.6 `src/chat_store.py`

The legacy database at `data/app.db` contains richer conversations, messages, memories, feedback, key/value profile state, and presets. It supports rename, pin, search, partial deletion, exports/imports, Markdown export, cleanup, and wipe operations. Attachment metadata stores references, sources, stats, and errors alongside messages.

## 8. End-to-end traces

### 8.1 v2 API run

```text
Browser POST /api/v1/runs
  → session middleware chooses chat_session
  → Pydantic validates RunCreate
  → RunManager stores queued RunState and schedules task
  → adapter receives session/env credential
  → GET /events replays run.started and run.delta events
  → terminal event closes SSE stream
  → GET /runs/{id} returns accumulated output
```

Important [gap]: the React composer does not initiate this trace, and the result is not written to `Store` or linked to `conversation_id`.

### 8.2 v2 conversation persistence

```text
POST /conversations → SQLite row
POST /conversations/{id}/messages → ordered SQLite row + updated timestamp
GET /conversations/{id} → conversation with messages by position
```

The caller currently has to coordinate conversation messages and runs itself.

### 8.3 legacy rich turn

```text
st.chat_input
  → app.py persists user message
  → jobs.start daemon thread
  → parse/index attachments + optional web search
  → orchestrator injects profile/memory/history/docs
  → Ollama or cloud provider streams chunks
  → Streamlit fragment polls Job.text
  → assistant message + metadata persist
  → title, history vector, memories, profile update best effort
```

### 8.4 legacy RAG question

```text
upload → parse text → chunk overlapping windows → embed → Chroma
question → embed → nearest chunks → bounded context → model answer
```

## 9. Data, privacy, and security

- [v2] conversation text persists in `data/v2/studio.db`; [legacy] richer data persists under `data/` and vectors in `data/chroma`.
- Session-entered keys remain in process memory. Environment fallback keys live outside app storage but are readable by the process.
- A cloud-provider request sends its messages and selected context to that provider. “Local-first” is not “always local.”
- Legacy uploaded content may be parsed locally, embedded by configured Ollama, and injected into a cloud-model request if a cloud model is selected.
- The cookie is `HttpOnly` and `SameSite=Strict`, but `secure=False` for local HTTP. It scopes secrets; it is not authentication, authorization, CSRF proof for every deployment, or encryption at rest.
- PKCE protects code exchange, not the application itself. Pending verifiers and keys disappear on restart.
- Exception strings currently surface in discovery/run failures; avoid placing secrets in upstream error text and logs.
- SQLite locks are process-local. In-memory runs/vaults will diverge across multiple Uvicorn workers.
- Never expose either app publicly without an authentication, TLS, origin, and deployment review.

## 10. Contributor tutorials

### 10.1 Add a v2 provider

1. Add the provider ID and environment variable to `backend/app/sessions.py::PROVIDER_ENV`.
2. Add its user-facing label to `PROVIDER_LABELS` in `main.py`.
3. Implement a `ProviderAdapter` or configure `OpenAICompatibleAdapter` in `build_provider_registry`.
4. Normalize results to `ModelDescriptor` and messages to the provider’s format.
5. Add adapter tests for registry presence, discovery failure isolation, and streamed deltas.
6. Add API tests for credential scope if behavior differs.

Tradeoff: reusing the OpenAI-compatible adapter is smallest, but only correct if the endpoint really matches the used models/chat streaming semantics.

### 10.2 Add an endpoint and regenerate frontend types

1. Define request/response models in `backend/app/contracts.py`.
2. Add the route in `create_app`; return explicit status codes and translate domain misses to HTTP errors.
3. Add a public-contract test in `tests/test_api_contract.py`.
4. Run `uv run python scripts/generate_api_types.py` (or `npm run generate:api` inside `frontend`).
5. Inspect the diff in `frontend/src/api/schema.ts`; never patch generated types manually.
6. Add a typed method to `frontend/src/api/client.ts` and a UI integration test.

If the schema becomes more complex than this generator supports, extend and test the generator before relying on its output.

### 10.3 Wire one React workspace

Use a narrow vertical slice, for example provider status:

1. Add loading, success, and error state to the Providers workspace.
2. Call `api.providers()` in an effect and render returned `key_source` values.
3. Remove only the corresponding hard-coded demo status.
4. Test loading/error/success behavior with mocked fetch.

For chat, the minimum coherent slice is larger: conversation creation, user-message persistence, run creation, SSE parsing, delta display, terminal/error/cancel handling, and assistant-message persistence. Decide explicitly whether the browser or backend owns that orchestration before implementing it.

### 10.4 Add a legacy file parser

1. Add the extension/MIME type to `src/files.py` constants.
2. Implement a focused parser accepting bytes and returning clean text.
3. Dispatch it from `parse_upload`, preserving filename, type, and errors.
4. Add representative parser tests, including empty/malformed input.
5. Exercise the full small-file direct-context and large-file chunk/RAG paths.

Avoid a new dependency if an existing library or the standard library suffices. Parsers handle untrusted input, so bound resource use and do not execute embedded content.

## 11. Testing, CI, and debugging

### 11.1 Local checks

```powershell
uv run python -m pytest -q
uv run ruff check backend tests
Set-Location frontend
npm run lint
npm test
npm run build
```

The same commands work in POSIX shells with `cd frontend`. CI runs backend and frontend jobs on Ubuntu, Python 3.12, and Node 22.12. The backend tests inject an in-memory database and fake registry where needed; the `echo` run avoids a network model.

Current test scope is intentionally small: API contracts, credential session isolation, SSE completion, PKCE construction, provider registry/discovery, and React shell rendering/navigation. [gap] Legacy feature paths have no committed automated coverage in the current tree.

### 11.2 Debugging playbook

| Symptom | First checks |
|---|---|
| `/` returns 404 on port 8000 | Build `frontend/dist`; confirm backend startup directory. |
| Vite UI cannot call API | Confirm backend on 8000 and `vite.config.ts` proxy. |
| provider discovery shows an error | Check only that provider’s key, base URL, and network; discovery intentionally degrades independently. |
| run stays queued/running | Inspect `/runs/{id}` and `/events`; check provider stream and server exception. |
| cancel appears delayed | Cancellation is checked between received chunks. |
| key disappears | Session keys are memory-only; restart/new cookie loses them. |
| legacy RAG returns nothing | Confirm embedding model, successful parsing, Chroma data, conversation scope, and similarity. |
| `.doc` is empty | Install LibreOffice or `antiword`; prefer `.docx` where possible. |

Debug in the sequence reproduce → localize → form one hypothesis → change one variable → verify. Read the complete server traceback and browser network response before changing code.

## 12. Module atlas

| Module | Marker | Owns |
|---|---|---|
| `backend/app/main.py` | [v2] | HTTP routes, middleware, PKCE exchange, static mount. |
| `backend/app/contracts.py` | [v2] | Pydantic API and event types. |
| `backend/app/store.py` | [v2] | Minimal SQLite conversations/messages schema. |
| `backend/app/sessions.py` | [v2] | Session credential vault and env fallback. |
| `backend/app/providers.py` | [v2] | Async adapters and concurrent discovery. |
| `backend/app/runs.py` | [v2] | In-memory streaming run lifecycle. |
| `backend/app/cli.py` | [v2] | Uvicorn console entry point. |
| `frontend/src/App.tsx` | [v2] [gap] | Mostly static SPA workspace shell. |
| `frontend/src/api/client.ts` | [v2] [gap] | Three API request primitives. |
| `frontend/src/api/schema.ts` | [v2] | Generated TypeScript contracts. |
| `scripts/generate_api_types.py` | [shared] | OpenAPI schema conversion. |
| `app.py` | [legacy] | Streamlit chat and UI orchestration. |
| `pages/*.py` | [legacy] | Memory, settings, providers, compare screens. |
| `src/jobs.py` | [legacy] | Background generation and attachments/search pipeline. |
| `src/orchestrator.py` | [legacy] | Context assembly and post-turn indexing. |
| `src/catalog.py` | [legacy] | Unified model selection. |
| `src/providers.py` | [legacy] | Cloud providers, secrets, endpoint/OAuth helpers. |
| `src/ollama_client.py` | [legacy] | Ollama discovery, generation, embeddings, vision, health. |
| `src/files.py` | [legacy] | File parsing and chunking. |
| `src/rag.py` | [legacy] | Chroma indexes and retrieval. |
| `src/memory.py` | [legacy] | Durable-fact extraction, deduplication, decay. |
| `src/personalization.py` | [legacy] | Rolling user profile. |
| `src/chat_store.py` | [legacy] | Rich SQLite domain store and data controls. |
| `src/config.py` | [legacy] | `CHAT_` Pydantic settings and data paths. |

## 13. Exercises and solution outlines

1. **Classify a feature.** Is “Memory” available in v2 because the navigation button exists?
   **Outline:** No. The React button and placeholder are [v2], but behavior is [legacy]; porting is [gap].

2. **Trace a run without the UI.** Create a run using the `echo` provider and consume events.
   **Outline:** POST a `RunCreate`, retain the ID, GET its `/events`, verify started/delta/completed, then GET its snapshot.

3. **Explain restart behavior.** What survives a v2 restart?
   **Outline:** SQLite conversations/messages survive. Runs, events, session keys, and PKCE verifiers do not.

4. **Find a concurrency guarantee.** Why can two messages get unique positions?
   **Outline:** `Store.add_message` calculates and inserts the next position within its `RLock` and SQLite transaction for one process.

5. **Find a concurrency limit.** Why are multiple Uvicorn workers unsafe for session keys?
   **Outline:** Each worker owns a separate in-memory vault and run registry; a cookie does not route every request to the same worker.

6. **Compare streaming architectures.**
   **Outline:** v2 uses async tasks and SSE; legacy uses daemon threads and Streamlit polling of shared `Job.text`.

7. **Explain RAG versus memory.**
   **Outline:** RAG retrieves source chunks relevant to a query; memory extracts durable user facts and deduplicates them. Both use embeddings but have different lifecycle and intent.

8. **Assess privacy for a cloud run.**
   **Outline:** keys are not written by the vault, but request messages/context leave the machine for the selected cloud provider. Local storage does not make that call local.

9. **Design the smallest frontend contribution.**
   **Outline:** Wire provider status first: one existing API method, three UI states, and a focused test. Full chat requires an orchestration ownership decision.

10. **Add a contract safely.**
    **Outline:** Pydantic model → route → pytest → regenerate schema → typed client → UI test → all CI commands.

11. **Investigate unused persistence.**
    **Outline:** Locate `runs` DDL in `store.py`; confirm `RunManager` never receives `Store`; propose either persistence integration or removing misleading schema in a separately approved change.

12. **Test a parser contribution.**
    **Outline:** valid bytes, malformed bytes, empty extraction, direct-context threshold, chunk overlap, indexing/retrieval, and no execution of embedded data.

## 14. Glossary

| Term | Meaning here |
|---|---|
| Adapter | Provider-specific implementation behind a normalized model interface. |
| API contract | Validated request, response, status, and event behavior callers may rely on. |
| Async task | Cooperative unit scheduled on an event loop. |
| BYOK | User supplies a cloud-provider credential. |
| ChromaDB | Legacy persistent vector database. |
| Context window | Token capacity shared by prompt and generated output. |
| Cosine similarity | Direction-based vector similarity measure. |
| Embedding | Numeric semantic representation. |
| EventSource/SSE | Browser/API mechanism for one-way server event streams. |
| LLM | Model that predicts token sequences. |
| Ollama | Local/remote model server used by both stacks. |
| Persistence | State that remains after restart. |
| PKCE | Proof Key for Code Exchange authorization protection. |
| RAG | Retrieve external evidence and add it to a generation request. |
| REST | Resource-oriented HTTP interface. |
| SPA | Browser application that changes views without full document navigation. |
| Temperature | Sampling parameter affecting output variability. |
| Token | Model-specific unit of text. |
| Vector database | Store/query system optimized for embedding similarity. |

## 15. Official sources

- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [FastAPI streaming responses](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [Pydantic documentation](https://docs.pydantic.dev/latest/)
- [Python `asyncio`](https://docs.python.org/3/library/asyncio.html)
- [SQLite documentation](https://www.sqlite.org/docs.html)
- [React documentation](https://react.dev/)
- [Vite documentation](https://vite.dev/guide/)
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [OAuth 2.0 PKCE, RFC 7636](https://www.rfc-editor.org/rfc/rfc7636)
- [Ollama documentation](https://docs.ollama.com/)
- [Chroma documentation](https://docs.trychroma.com/)
- [OpenAI API documentation](https://platform.openai.com/docs/)
- [Anthropic API documentation](https://docs.anthropic.com/)
- [Google Gen AI SDK documentation](https://googleapis.github.io/python-genai/)
- [OpenRouter OAuth PKCE documentation](https://openrouter.ai/docs/use-cases/oauth-pkce)
- [uv documentation](https://docs.astral.sh/uv/)
- [Streamlit documentation](https://docs.streamlit.io/)

## 16. A practical contributor path

First run both applications and observe the parity gap. Next, read and test one v2 vertical slice. Make one small contract-backed change, regenerate types if needed, and run both CI command sets. Treat legacy modules as the behavioral reference, not as code that must be copied: preserve behavior while choosing interfaces appropriate to FastAPI and React.

Before opening a pull request, answer four questions: What user-visible behavior changed? Which stack owns it? What persists and what is session-only? Which automated test proves the public contract?
