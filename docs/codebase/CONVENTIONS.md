# Coding Conventions

## 1) Naming Rules

| Item | Rule | Example | Evidence |
|------|------|---------|----------|
| Python files | lowercase `snake_case`; numbered Streamlit pages are an exception | `ollama_client.py`, `1_Memory.py` | `src/`, `pages/` |
| Python functions/methods | `snake_case`; internal helpers start `_` | `build_messages`, `_process_attachments` | `src/orchestrator.py`, `src/jobs.py` |
| Python/TypeScript types | `PascalCase` | `RunManager`, `ProviderAdapter`, `ErrorBoundary` | `backend/app/runs.py`, `frontend/src/ErrorBoundary.tsx` |
| React functions | `PascalCase` components; camelCase callbacks/values | `ChatWorkspace`, `setPage` | `frontend/src/App.tsx` |
| Constants/env vars | uppercase `SNAKE_CASE`; environment variables include provider names or `CHAT_` prefix | `MEMORY_COLLECTION`, `OPENAI_API_KEY` | `src/rag.py`, `backend/app/sessions.py` |

## 2) Formatting and Linting

- No repository-wide formatter is configured.
- Ruff checks only `backend` and `tests` in CI; the legacy Python stack is outside that command.
- Oxlint enables React hooks as errors and Fast Refresh component-export checks as warnings.
- TypeScript enables bundler resolution, `noEmit`, unused-local/parameter checks, forced module detection, and fallthrough protection; the explicit `strict` option is absent.
- Commands: `uv run ruff check backend tests`, `cd frontend && npm run lint`, and `npm run build` for TypeScript checking.

## 3) Import and Module Conventions

- Python generally groups standard-library, third-party, and local imports, using absolute package-root imports.
- Legacy modules sometimes use lazy imports to break cycles, for example `src.ollama_client._client()` importing `src.providers` at call time.
- Frontend shared imports use `@/`; nearby API/error-boundary imports use relative paths.
- There is no Python or TypeScript barrel-export policy; modules are imported directly.
- Generated `frontend/src/api/schema.ts` must be regenerated after FastAPI contract changes.

## 4) Error and Logging Conventions

- Legacy background work catches broad exceptions, writes contextual Loguru messages, converts provider failures to `_friendly_error()`, and persists visible assistant error turns.
- Optional legacy cleanup/post-processing generally logs warnings/errors and continues.
- v2 HTTP boundaries translate missing resources to `HTTPException(404)`; asynchronous run failures become `RunStatus.failed` plus a retained `run.failed` event.
- Provider discovery degrades per provider by returning a `ProviderDiscovery.error` string.
- Legacy code uses Loguru; v2 application modules have no explicit application logger and rely on Uvicorn/default exception handling.
- Credentials are intended never to be logged or persisted. There is no general-purpose redaction helper for other potentially sensitive provider errors.

## 5) Testing Conventions

- Backend tests live in `tests/` and use `test_*.py`; shared setup is in `tests/conftest.py`.
- Frontend tests are co-located as `*.test.tsx`; global cleanup is configured in `frontend/src/test/setup.ts`.
- Backend isolation uses `create_app(database_url=":memory:")`, injectable provider registries, and local stub adapters.
- Frontend tests use React Testing Library queries and Vitest assertions in jsdom.
- [TODO] No coverage threshold or stated coverage target exists.

## 6) Evidence

- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`
- `frontend/.oxlintrc.json`
- `frontend/tsconfig.app.json`
- `src/jobs.py`
- `backend/app/main.py`
- `tests/conftest.py`
