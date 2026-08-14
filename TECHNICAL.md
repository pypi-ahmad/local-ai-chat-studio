# Technical Guide

Local AI Chat Studio is a local-first FastAPI and React workspace. This page
is the concise technical entrypoint; the detailed architecture map lives in
[docs/codebase/](docs/codebase/) and the extended tutorial in
[CODE_TUTORIAL.md](CODE_TUTORIAL.md).

## Runtime architecture

```text
React/Vite frontend -> /api/v1 -> FastAPI application -> providers / local stores
                                      |                 -> Ollama / cloud APIs
                                      +-> SSE run events -> browser
```

`backend/app/cli.py` starts Uvicorn on `127.0.0.1:8506` and passes a shutdown
callback into `create_app()`. `backend/app/main.py` composes the API, static
frontend serving, session boundary, persistence, providers, run manager,
workspace services, and managed shutdown. During frontend development, Vite
proxies `/api` to `http://127.0.0.1:8506`; production builds are served by
FastAPI.

`POST /api/v1/runtime/shutdown` is the Settings **Stop Studio** path. It
requires the `X-Local-Studio: shutdown` header, cancels in-flight runs through
`RunManager.shutdown()`, waits for those background tasks, then asks Uvicorn to
exit. Without a shutdown callback (unmanaged/test mode) the route returns 503.
Process lifespan shutdown also waits for runs and closes the SQLite connection.

## Data, sessions, and runs

- `data/app.db` is the canonical SQLite store for conversations, messages,
  memories, presets, feedback, activity, and data-control metadata.
- `data/chroma` holds the optional retrieval index and `data/uploads` holds
  local uploaded-file data. `CHAT_DATA_DIR` relocates the whole data area.
- The backend creates an HTTP-only, same-site `chat_session` cookie. API keys
  entered in the browser are held by an in-memory session vault and are cleared
  by the data-wipe flow; they are not written to SQLite or replay bundles.
- A run is created through `/api/v1/runs`, streamed through an SSE event
  endpoint, persisted with its context and provenance, and can be cancelled,
  replayed, bundled, or compared.
- The Compare workspace creates one independent run for each of two to four
  distinct selected models. The browser starts and follows those runs concurrently,
  keeps output and failures isolated by provider/model key, and cancels every known
  run when **Cancel all** is selected. No separate batch API is required.
- Memory curation uses an LLM to keep only durable, explicit user facts,
  preferences, goals, constraints, and project decisions. It excludes secrets,
  raw files, assistant claims, and transient chat details.

## Main subsystems

| Area | Primary location | Responsibility |
| --- | --- | --- |
| HTTP contracts and routes | `backend/app/contracts.py`, `backend/app/main.py` | Pydantic API shapes, `/api/v1` endpoints, managed shutdown |
| Process entry | `backend/app/cli.py` | Uvicorn on `127.0.0.1:8506` and shutdown callback |
| Runs and streaming | `backend/app/runs.py` | Run lifecycle, cancellation, SSE events, receipts, task drain |
| Context safety and retrieval | `backend/app/workspace.py` | Context planning, pruning, provenance, retrieval, safety scanning |
| Local persistence | `backend/app/store.py` | SQLite schema, conversations, memory, exports, imports |
| Providers and OAuth bridges | `backend/app/providers.py`, `backend/app/sessions.py` | Provider adapters, discovery, credential/session handling |
| Model pricing | `backend/app/pricing.py` | Official-source standard token-rate catalog and OpenRouter live-price normalization |
| Web client | `frontend/src/` | React workspaces and generated typed API client |
| Shared helpers | `src/` | File parsing, Ollama health/embeddings, and Chroma retrieval |

## Providers and integrations

Ollama is the default local provider. The backend also supports Ollama Cloud,
OpenAI, Agnes AI (`agnes-2.5-flash`), Anthropic, Gemini, OpenRouter, xAI, OpenCode Zen/Go, and compatible
gateways. Provider discovery and request execution use normalized adapters;
credentials may come from the in-memory session vault or documented environment
fallbacks.

`ProviderRegistry` attaches `ModelPricing` metadata after discovery. Known direct
providers use the dated catalog in `pricing.py`; OpenRouter prices are normalized from
its live Models API. The frontend uses preflight token estimates for input cost only.
Custom OpenAI base URLs and other unverified gateways deliberately receive no price.

The React client uses one capability-aware model-picker contract across Chat,
Compare, Replay, and assistant configuration. It scopes discovery by provider,
searches model names/IDs/capabilities, and filters vision or reasoning support.
Shared presentation contracts also cover safe Markdown/code/KaTeX rendering,
attachment upload states, transcript navigation, and context utilization warnings.
Each conversation stores a validated JSON settings snapshot in SQLite. The generated
`Conversation` contract returns model key, reasoning effort, temperature, context
policy, web/compression flags, system prompt, and layout; the React client hydrates
these values on selection and saves changes through the conversation PATCH endpoint.
`ConversationCreate` also accepts the validated settings snapshot, allowing Library
assistants to create a configured conversation atomically rather than creating and
then patching it. Assistant favorites and the four most recent launches are UI
preferences stored in browser local storage; preset definitions remain authoritative
SQLite records.
Branches copy the snapshot at creation, preserving independent settings afterward.
Optional context compression deterministically replaces older history with a bounded
extractive summary, retains the latest eight messages verbatim, records compression
metadata in the hash-bound plan, and prevents over-budget plans from starting a run.
The grouped desktop/mobile navigation and optional persisted Context/Evidence
inspector are client-side views over the same workspace APIs.

Conversation exports use `GET /api/v1/conversations/{id}/export/{format}` for
`markdown`, `html`, `txt`, and `json`; the legacy `export.md` route remains available.
Markdown, text, and JSON serialize the persisted conversation directly. Standalone
HTML escapes the title, model, role, and message content and includes a restrictive
document CSP, so stored prompt or model markup is never emitted as executable HTML.
The Chat menu resolves the newest completed run whose `conversation_id` matches the
active chat and reuses the session-scoped `GET /api/v1/runs/{id}/bundle` contract for
the reproducibility export.

The OpenAI-compatible adapter omits `temperature` for `gpt-5.6-luna` because that
model accepts only its provider default. Other compatible models continue to receive
the user-selected temperature. Agnes AI uses its fixed official endpoint and discovers
`agnes-2.5-flash` live rather than relying on a hardcoded catalog.

The custom conversation system prompt is included in `TurnPreflight`, context-token
estimation, the hash-bound plan, assembled provider messages, and replay records. An
empty value retains the built-in direct-and-accurate assistant instruction.

OpenRouter uses a local PKCE flow. ChatGPT, SuperGrok, and Claude subscription
flows are delegated through a local OpenCode server. The server URL must use a
loopback host, preventing an accidental remote bridge configuration.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `CHAT_DATA_DIR` | Local data directory | `data` |
| `CHAT_OLLAMA_HOST` | Ollama endpoint | `http://localhost:11434` |
| `CHAT_EMBED_MODEL` | Installed Ollama embedding model for Chroma retrieval | unset |
| `OLLAMA_API_KEY` | Ollama Cloud fallback key | unset |
| `OPENAI_API_KEY`, `AGNES_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Cloud-provider fallback keys | unset |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible endpoint for the OpenAI provider | official OpenAI endpoint |
| `OPENROUTER_API_KEY`, `XAI_API_KEY` | Gateway and xAI fallback keys | unset |
| `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY` | Compatible-gateway endpoint and fallback key | `http://localhost:8082/v1` / unset |
| `OPENCODE_ZEN_API_KEY`, `OPENCODE_GO_API_KEY` | OpenCode inference fallback keys | unset |
| `OPENCODE_SERVER_URL` | Local OpenCode bridge | `http://127.0.0.1:4096` |
| `OPENCODE_SERVER_USERNAME`, `OPENCODE_SERVER_PASSWORD` | Optional OpenCode bridge authentication | unset / `opencode` |

## API contracts and development

The OpenAPI contract originates from FastAPI/Pydantic models. When a contract
in `backend/app/contracts.py` changes, regenerate the frontend client from
`frontend/` with `npm run generate:api`, then commit the generated schema.
Frontend TypeScript is pinned to 5.9. Use `npm ci --legacy-peer-deps` so the
same peer-dependency resolution as the Windows launcher applies.

`Launch Chat Studio.sh` mirrors that cached setup on glibc Linux for x86_64 and
ARM64. Its portable `uv`, Python, Node.js, download, and npm caches live below
`.runtime/linux`; the project environment remains `.venv`. Node.js archives are
downloaded from the official distribution and checked against `SHASUMS256.txt`.
The launcher uses no system package manager or elevated privileges.
Both launchers persist content fingerprints only after successful Python sync, npm
installation, or frontend build. Normal launch clears port `8506`: it first uses the
managed shutdown API for a recognized Studio and then terminates any remaining
listener. `--check` reports this state without changing it.

Run the same checks used in CI before opening a pull request:

```powershell
uv run python -m pytest -q
uv run ruff check backend tests
cd frontend
npm run lint
npm test
npm run build
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and
[SECURITY.md](SECURITY.md) before changing credentials, sessions, uploads, or
network-facing behavior.
