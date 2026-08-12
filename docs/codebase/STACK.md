# Technology Stack

## 1) Runtime Summary

| Area | Value | Evidence |
|------|-------|----------|
| Primary language | Python, with a TypeScript/React frontend | `.python-version`, `frontend/tsconfig.app.json` |
| Runtime + version | Python 3.12; Node.js 22.12 in CI. [TODO] Supported local Node.js range is not declared. | `.python-version`, `.github/workflows/ci.yml` |
| Package managers | `uv` for Python; npm for the frontend | `pyproject.toml`, `uv.lock`, `frontend/package-lock.json` |
| Module/build system | Hatchling Python package; ESM TypeScript compiled by TypeScript and Vite | `pyproject.toml`, `frontend/package.json` |

## 2) Production Frameworks and Dependencies

Versions below are the declared minimums/ranges, not necessarily the resolved lockfile versions.

| Dependency | Version | Role in system | Evidence |
|------------|---------|----------------|----------|
| Streamlit | `>=1.58.0` | Mature multipage UI | `pyproject.toml`, `app.py`, `pages/` |
| FastAPI / Uvicorn | `>=0.139.2` / `>=0.49.0` | v2 HTTP API and local server | `pyproject.toml`, `backend/app/main.py`, `backend/app/cli.py` |
| React / React DOM | `^19.2.7` | v2 browser UI shell | `frontend/package.json`, `frontend/src/App.tsx` |
| Vite / Tailwind CSS | `^8.1.1` / `^4.3.3` | Frontend build and styling | `frontend/package.json`, `frontend/vite.config.ts` |
| Ollama | `>=0.6.2` | Local/remote model discovery, chat, vision, embeddings | `pyproject.toml`, `src/ollama_client.py`, `backend/app/providers.py` |
| OpenAI / Anthropic / Google GenAI SDKs | `>=2.41.1` / `>=0.109.1` / `>=2.13.0` | Cloud-provider adapters | `pyproject.toml`, `src/providers.py`, `backend/app/providers.py` |
| ChromaDB | `>=1.5.9` | Persistent vector retrieval for documents, history, and memory | `pyproject.toml`, `src/rag.py` |
| Pydantic Settings | `>=2.14.1` | Environment and `.env` configuration for the legacy stack | `pyproject.toml`, `src/config.py` |
| DDGS | `>=9.14.4` | Optional DuckDuckGo web search | `pyproject.toml`, `src/jobs.py` |
| pandas / openpyxl / xlrd | `>=3.0.3` / `>=3.1.5` / `>=2.0.2` | Excel parsing | `pyproject.toml`, `src/files.py` |
| pypdf / python-docx | `>=6.13.2` / `>=1.2.0` | PDF and Word extraction | `pyproject.toml`, `src/files.py` |
| Loguru | `>=0.7.3` | Legacy application logging | `pyproject.toml`, `src/jobs.py` |
| Base UI / CVA / clsx / tailwind-merge / Lucide | Declared in `frontend/package.json` | UI primitives, class composition, and icons | `frontend/package.json`, `frontend/src/components/ui/` |

SQLite is accessed through Python's standard `sqlite3` module; there is no ORM.

## 3) Development Toolchain

| Tool | Purpose | Evidence |
|------|---------|----------|
| pytest / pytest-asyncio | Backend tests | `pyproject.toml`, `tests/` |
| Ruff | Python linting, scoped to `backend` and `tests` in CI | `pyproject.toml`, `.github/workflows/ci.yml` |
| Vitest / Testing Library / jsdom | React component tests | `frontend/package.json`, `frontend/vitest.config.ts` |
| Oxlint | TypeScript/React linting | `frontend/.oxlintrc.json` |
| TypeScript | Static checking with `noEmit` and unused-code checks | `frontend/tsconfig.app.json` |
| openapi-typescript | Generates `frontend/src/api/schema.ts` from FastAPI OpenAPI | `frontend/package.json`, `scripts/generate_api_types.py` |
| GitHub Actions | Backend and frontend CI jobs | `.github/workflows/ci.yml` |

No formatter, container image, deployment manifest, or performance-test tool is configured.

## 4) Key Commands

```bash
uv sync --locked --dev
uv run chat-studio
uv run streamlit run app.py
uv run python -m pytest -q
uv run ruff check backend tests
cd frontend && npm ci
cd frontend && npm run dev
cd frontend && npm run lint && npm test && npm run build
cd frontend && npm run generate:api
```

## 5) Environment and Config

- Legacy configuration comes from `src/config.py`, `.env`, and `CHAT_`-prefixed environment variables.
- v2 reads `CHAT_DATA_DIR`, `CHAT_OLLAMA_HOST`, `OMNIROUTE_BASE_URL`, and provider-key environment variables directly.
- Provider credentials: `OLLAMA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, and `OMNIROUTE_API_KEY`.
- Legacy tuning includes `CHAT_TEMPERATURE`, `CHAT_KEEP_ALIVE`, `CHAT_REQUEST_TIMEOUT`, retrieval limits, memory limits, and feature toggles corresponding to fields in `AppConfig`.
- The local FastAPI server binds to `127.0.0.1:8000`; the Vite development server binds to `127.0.0.1` and proxies `/api` to it.
- [TODO] No production process manager or supported deployment topology is declared.

## 6) Evidence

- `pyproject.toml`
- `.python-version`
- `frontend/package.json`
- `frontend/tsconfig.app.json`
- `.github/workflows/ci.yml`
- `src/config.py`
- `backend/app/cli.py`
