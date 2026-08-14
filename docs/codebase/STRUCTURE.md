# Codebase Structure

| Path | Responsibility |
|---|---|
| `backend/app/cli.py` | Uvicorn on `127.0.0.1:8506` and managed-shutdown callback |
| `backend/app/main.py` | FastAPI composition, routes, session cookies, OAuth, static client, shutdown |
| `backend/app/contracts.py` | Pydantic API contracts, conversation-settings validation, and generated-schema source |
| `backend/app/runs.py` | Async streaming lifecycle, cancellation, events, receipts, task drain |
| `backend/app/store.py` | Legacy-compatible SQLite schema, migrations, and conversation-settings persistence |
| `backend/app/memory.py` | Whole-chat LLM memory selection, consolidation, and validation |
| `backend/app/workspace.py` | Context plans, safety, provenance, web and retrieval |
| `backend/app/providers.py` | Provider adapters and model discovery |
| `backend/app/pricing.py` | Source-linked standard token-rate catalog and normalization |
| `frontend/src/` | React workspace, rich Markdown/LaTeX/Mermaid rendering, capability-aware model selection, per-conversation controls/layouts, context/evidence inspection, 2–4 model comparison, design system, typed API client |
| `frontend/src/features/models/` | Model metadata/search helpers and browser-local favorite/recent preferences |
| `frontend/src/features/assistants/` | Browser-local assistant favorite and recent-launch preferences |
| `frontend/src/features/artifact-preview/` | Fenced-output classification, sandbox document policy, and responsive Chat preview pane |
| `src/files.py` | Shared document/image parsing and upload validation |
| `src/rag.py` | Existing Chroma collections and embedding retrieval |
| `src/ollama_client.py` | Shared Ollama discovery, health, and embedding helpers |
| `tests/` | Backend contracts, lifecycle, provider, safety, and workspace tests |
| `data/` | Local SQLite/Chroma runtime state |
| `Launch Chat Studio.cmd` | Portable Windows setup detection, installation, launch, and browser opening |
| `Launch Chat Studio.sh` | Equivalent cached setup, port recovery, launch, and browser opening for supported Linux desktops |

`chat-studio` starts `backend.app.cli:main` on `127.0.0.1:8506`. FastAPI serves
`frontend/dist` when it exists; Vite proxies `/api` to that same origin during
frontend development. The Settings **Stop Studio** control calls
`POST /api/v1/runtime/shutdown` with the `X-Local-Studio: shutdown` header.

The Streamlit entrypoint and `pages/` were removed after the React workspace moved to
the shared `data/app.db` schema. Older service modules under `src/` remain only where
they still provide shared parsing, Ollama, or Chroma behavior.
