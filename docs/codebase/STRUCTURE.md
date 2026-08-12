# Codebase Structure

## 1) Top-Level Map

| Path | Purpose | Evidence |
|------|---------|----------|
| `app.py` | Legacy Streamlit chat page and UI orchestration | `app.py` |
| `pages/` | Streamlit Memory, Settings, Providers, and Compare pages | `pages/1_Memory.py`, `pages/4_Compare.py` |
| `src/` | Legacy application services: jobs, persistence, RAG, memory, providers, files, and configuration | `src/jobs.py`, `src/chat_store.py`, `src/orchestrator.py` |
| `backend/app/` | v2 FastAPI contracts, routes, providers, runs, sessions, and SQLite store | `backend/app/main.py`, `backend/app/runs.py` |
| `frontend/` | v2 React/Vite shell, generated API schema, and UI primitives | `frontend/src/App.tsx`, `frontend/src/api/schema.ts` |
| `tests/` | v2 backend API/provider tests | `tests/test_api_contract.py`, `tests/test_provider_adapters.py` |
| `scripts/` | OpenAPI export/type-generation support | `scripts/generate_api_types.py` |
| `docs/` | Screenshots, tutorials, archive, site shell, and this codebase map | `docs/site/index.html`, `docs/tutorial/index.html` |
| `.github/` | CI and contribution templates | `.github/workflows/ci.yml` |
| `data/` | Git-ignored runtime SQLite, Chroma, and upload data | `src/config.py`, `backend/app/main.py`, `.gitignore` |

Local analysis/build directories such as `.codegraph/`, `.code-review-graph/`, `.ua/`, `frontend/dist/`, caches, and generated `frontend/src/api/schema.ts` are not source-convention examples.

## 2) Entry Points

- v2 CLI: `chat-studio` maps to `backend.app.cli:main`, which starts Uvicorn with `create_app()`.
- Legacy UI: `uv run streamlit run app.py`; Streamlit discovers the numbered modules under `pages/`.
- Frontend browser entry: `frontend/src/main.tsx`; Vite builds `frontend/index.html` and the FastAPI app serves `frontend/dist/` when present.
- Background work is not a separate process: `src/jobs.py` starts daemon threads in the legacy process, while `backend/app/runs.py` starts asyncio tasks in the v2 process.

## 3) Module Boundaries

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| `app.py`, `pages/` | Streamlit state, widgets, rendering, and user-event orchestration | Provider protocol details and persistent query logic |
| `src/jobs.py`, `src/orchestrator.py` | Legacy generation lifecycle, prompt assembly, retrieval coordination | Streamlit API calls from worker threads |
| `src/chat_store.py`, `src/rag.py` | Legacy SQLite and Chroma access | UI rendering |
| `src/providers.py`, `src/ollama_client.py` | Legacy provider/SDK translation and runtime model discovery | Streamlit widgets |
| `backend/app/main.py` | FastAPI composition, middleware, and route boundaries | Provider-specific streaming implementations |
| `backend/app/providers.py` | v2 provider adapter contract and implementations | HTTP route definitions |
| `backend/app/runs.py` | v2 run state, async execution, SSE events, and cancellation state | Browser rendering |
| `frontend/src/` | React presentation and typed API client | Direct database/provider access |

## 4) Naming and Organization Rules

- Python modules and functions use `snake_case`; classes use `PascalCase`; private helpers start with `_`.
- Streamlit page filenames are numbered and use title-style names, for example `1_Memory.py`.
- React components use `PascalCase`; utility/UI source files use lowercase or kebab-style names.
- Python imports use package-root paths such as `from src import rag` and `from backend.app...`.
- Frontend imports use the `@/* -> ./src/*` alias for shared modules and relative imports for nearby files.
- The repository is layer-oriented inside each of two application stacks, not a monorepo or package workspace.

## 5) Evidence

- `pyproject.toml`
- `app.py`
- `src/jobs.py`
- `backend/app/cli.py`
- `backend/app/main.py`
- `frontend/src/main.tsx`
- `frontend/tsconfig.json`
