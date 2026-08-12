# Codebase Structure

| Path | Responsibility |
|---|---|
| `backend/app/main.py` | FastAPI composition, routes, session cookies, OAuth, static client |
| `backend/app/contracts.py` | Pydantic API contracts and generated-schema source |
| `backend/app/runs.py` | Async streaming lifecycle, cancellation, events, receipts |
| `backend/app/store.py` | Legacy-compatible SQLite schema and persistence |
| `backend/app/memory.py` | Whole-chat LLM memory selection, consolidation, and validation |
| `backend/app/workspace.py` | Context plans, safety, provenance, web and retrieval |
| `backend/app/providers.py` | Provider adapters and model discovery |
| `frontend/src/` | React workspace, design system, typed API client |
| `src/files.py` | Shared document/image parsing and upload validation |
| `src/rag.py` | Existing Chroma collections and embedding retrieval |
| `src/ollama_client.py` | Shared Ollama discovery, health, and embedding helpers |
| `tests/` | Backend contracts, lifecycle, provider, safety, and workspace tests |
| `data/` | Local SQLite/Chroma runtime state |

`chat-studio` starts `backend.app.cli:main` on `127.0.0.1:8000`. FastAPI serves
`frontend/dist` when it exists; Vite proxies `/api` during frontend development.

The Streamlit entrypoint and `pages/` were removed after the React workspace moved to
the shared `data/app.db` schema. Older service modules under `src/` remain only where
they still provide shared parsing, Ollama, or Chroma behavior.
