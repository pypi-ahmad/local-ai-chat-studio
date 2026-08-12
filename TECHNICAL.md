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

`backend/app/cli.py` starts Uvicorn on `127.0.0.1`. `backend/app/main.py`
composes the API, static frontend serving, session boundary, persistence,
providers, run manager, and workspace services. During frontend development,
Vite proxies `/api` to the backend; production builds are served by FastAPI.

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
- Memory curation uses an LLM to keep only durable, explicit user facts,
  preferences, goals, constraints, and project decisions. It excludes secrets,
  raw files, assistant claims, and transient chat details.

## Main subsystems

| Area | Primary location | Responsibility |
| --- | --- | --- |
| HTTP contracts and routes | `backend/app/contracts.py`, `backend/app/main.py` | Pydantic API shapes and `/api/v1` endpoints |
| Runs and streaming | `backend/app/runs.py` | Run lifecycle, cancellation, SSE events, receipts |
| Context safety and retrieval | `backend/app/workspace.py` | Context planning, pruning, provenance, retrieval, safety scanning |
| Local persistence | `backend/app/store.py` | SQLite schema, conversations, memory, exports, imports |
| Providers and OAuth bridges | `backend/app/providers.py`, `backend/app/sessions.py` | Provider adapters, discovery, credential/session handling |
| Web client | `frontend/src/` | React workspaces and generated typed API client |
| Legacy compatibility | `src/` | Existing file parsing, Chroma retrieval, and Streamlit-era helpers |

## Providers and integrations

Ollama is the default local provider. The backend also supports Ollama Cloud,
OpenAI, Anthropic, Gemini, OpenRouter, xAI, OpenCode Zen/Go, and compatible
gateways. Provider discovery and request execution use normalized adapters;
credentials may come from the in-memory session vault or documented environment
fallbacks.

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
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Cloud-provider fallback keys | unset |
| `OPENROUTER_API_KEY`, `XAI_API_KEY` | Gateway and xAI fallback keys | unset |
| `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY` | Compatible-gateway endpoint and fallback key | `http://localhost:8082/v1` / unset |
| `OPENCODE_ZEN_API_KEY`, `OPENCODE_GO_API_KEY` | OpenCode inference fallback keys | unset |
| `OPENCODE_SERVER_URL` | Local OpenCode bridge | `http://127.0.0.1:4096` |
| `OPENCODE_SERVER_USERNAME`, `OPENCODE_SERVER_PASSWORD` | Optional OpenCode bridge authentication | unset / `opencode` |

## API contracts and development

The OpenAPI contract originates from FastAPI/Pydantic models. When a contract
in `backend/app/contracts.py` changes, regenerate the frontend client from
`frontend/` with `npm run generate:api`, then commit the generated schema.

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
