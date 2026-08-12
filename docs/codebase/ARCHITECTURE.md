# Architecture

## 1) Architectural Style

- Primary style: two parallel layered applications sharing a product concept but not a unified application/data layer.
- The legacy stack is Streamlit UI -> background job/orchestration -> service modules -> SQLite/Chroma/provider SDKs.
- The v2 stack is React shell -> FastAPI routes -> run/provider/session/store objects -> SQLite/provider SDKs, with SSE for run events.
- Primary constraints are local-first execution, runtime model discovery, in-memory credentials, and keeping slow generation off the UI execution path.

## 2) System Flows

### Legacy chat flow

```text
app.py -> src/jobs.py daemon thread -> src/orchestrator.py -> memory/RAG/files/providers -> SQLite + Chroma + model API -> Streamlit polling
```

1. `send_user_message()` persists the user turn and calls `start_generation()`.
2. `jobs.start()` records a process-global `Job` and starts a daemon thread.
3. `_process_attachments()` parses/OCRs files and indexes large documents; optional DDGS results are appended as context.
4. `build_messages()` combines the system prompt, profile, memories, cross-chat hits, document hits, attachments, and up to 20 history messages.
5. `_stream()` dispatches to Ollama or a BYOK provider and updates the shared `Job` as deltas arrive.
6. The worker persists the answer to SQLite, then best-effort auto-titles, indexes history, extracts memories, and refreshes personalization.

### v2 run flow

```text
React/API client -> FastAPI /api/v1/runs -> RunManager asyncio task -> ProviderAdapter -> in-memory RunState/SSE -> optional SQLite message
```

1. `create_app()` constructs one `Store`, `SessionVault`, `ProviderRegistry`, and `RunManager` per application instance.
2. Middleware assigns an HTTP-only `chat_session` cookie; credentials are resolved from that session or environment variables.
3. `RunManager.create()` records a queued in-memory snapshot and schedules `_execute()`.
4. `_execute()` streams through an adapter, appends output, and emits retained `RunEvent` objects.
5. `/events` replays retained events and waits on an `asyncio.Event`; completed output can be appended to a v2 conversation.
6. When `frontend/dist/` exists, FastAPI mounts it at `/`.

The current React `App.tsx` is a presentation shell with hard-coded conversations/providers; `frontend/src/api/client.ts` exists but is not imported by the shell.

## 3) Layer/Module Responsibilities

| Layer or module | Owns | Must not own | Evidence |
|-----------------|------|--------------|----------|
| Streamlit presentation | Session state, widgets, reruns, page navigation | Slow model/file work | `app.py`, `pages/` |
| Legacy job/orchestration | Threaded lifecycle, context composition, post-processing | Streamlit calls in workers | `src/jobs.py`, `src/orchestrator.py` |
| Legacy domain support | Memory extraction, profile rebuilding, file parsing, catalog policy | HTTP route definitions | `src/memory.py`, `src/personalization.py`, `src/files.py`, `src/catalog.py` |
| Legacy persistence | Conversation/memory/preset SQL and vector retrieval | UI state | `src/chat_store.py`, `src/rag.py` |
| v2 API composition | Middleware, routes, OAuth callback, static mounting | SDK-specific message conversion | `backend/app/main.py` |
| v2 provider layer | Adapter interface, discovery, streaming conversion | Cookie/session management | `backend/app/providers.py` |
| v2 run layer | Run state machine, retained events, background tasks | React rendering | `backend/app/runs.py` |
| React shell | Navigation, page shell, typed client boundary | Direct model/database access | `frontend/src/App.tsx`, `frontend/src/api/client.ts` |

## 4) Reused Patterns

| Pattern | Where found | Why it exists |
|---------|-------------|---------------|
| Adapter/strategy | `backend/app/providers.py`, `src/providers.py` | Normalize multiple model-provider protocols |
| Factory/composition root | `backend/app/main.py:create_app` | Construct injectable registry/store and support tests |
| Repository-like persistence modules | `src/chat_store.py`, `backend/app/store.py` | Isolate SQLite statements from UI/routes |
| Process-global singleton/cache | `src/config.py`, `src/rag.py`, `src/jobs.py`, `src/ollama_client.py` | Share legacy settings, Chroma client, jobs, and Ollama clients across reruns |
| Producer/consumer event stream | `backend/app/runs.py` | Retain and stream run lifecycle events over SSE |
| Best-effort post-processing | `src/jobs.py`, `src/memory.py`, `src/personalization.py` | Keep title/index/profile failures from invalidating a completed reply |

## 5) Known Architectural Risks

- The two stacks duplicate providers, persistence, credential handling, and run lifecycle behavior; fixes can land in one path but not the other.
- Legacy data uses `data/app.db` and `data/chroma`; v2 defaults to `data/v2/studio.db` and currently does not expose legacy memory/RAG services.
- v2 run state and retained events are only in memory even though its schema declares a `runs` table; restarts lose them.
- The React shell and FastAPI backend are not yet connected for primary chat flows.
- Legacy singleton state and v2 in-memory state assume a single process; horizontal scaling would split jobs, credentials, and event state.

## 6) Evidence

- `app.py`
- `src/jobs.py`
- `src/orchestrator.py`
- `src/chat_store.py`
- `src/rag.py`
- `backend/app/main.py`
- `backend/app/runs.py`
- `frontend/src/App.tsx`
