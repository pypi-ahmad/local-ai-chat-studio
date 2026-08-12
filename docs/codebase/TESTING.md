# Testing Patterns

## 1) Test Stack and Commands

- Backend: pytest `>=9.1.1`, pytest-asyncio `>=1.4.0`, FastAPI `TestClient`, and plain `assert`.
- Frontend: Vitest `^4.1.10`, React Testing Library, jest-dom matchers, and jsdom.
- Current local verification on 2026-08-12: 8 backend tests and 3 frontend tests passed; Ruff and the frontend build passed. This is terminal evidence, not a committed coverage report.

```bash
uv run python -m pytest -q
uv run ruff check backend tests
cd frontend && npm run lint
cd frontend && npm test
cd frontend && npm run build
# No dedicated E2E or coverage command is configured.
```

## 2) Test Layout

- Backend tests are centralized in `tests/`: API contracts in `test_api_contract.py`, adapters in `test_provider_adapters.py`, and shared app setup in `conftest.py`.
- Frontend tests are co-located under `frontend/src/` as `*.test.tsx`; `frontend/src/test/setup.ts` registers jest-dom and cleanup.
- CI runs backend tests/lint and frontend lint/test/build as separate Ubuntu jobs.

## 3) Test Scope Matrix

| Scope | Covered? | Typical target | Notes |
|-------|----------|----------------|-------|
| Unit | Partial | Provider registry behavior and React shell rendering | Provider test uses a stub adapter; component tests use jsdom |
| Integration | Partial | FastAPI routes with in-memory SQLite, session cookie, SSE echo run | No real external provider, Chroma, file, or legacy job integration |
| E2E | No | Browser-to-model user flows | No browser runner or live service harness is configured |

## 4) Mocking and Isolation Strategy

- `create_app(database_url=":memory:")` isolates backend persistence per fixture lifecycle.
- Provider behavior is injected through `ProviderRegistry` and tested with a local `StubAdapter`.
- The deterministic internal `echo` provider exercises the run/SSE contract without network access.
- Frontend tests render the real `App` component but do not mock or call the API client.
- Current tests do not exercise the mature Streamlit/legacy `src/` stack.

## 5) Coverage and Quality Signals

- Coverage tool + threshold: `[TODO]` none configured.
- Current reported coverage: `[TODO]` no coverage report is generated.
- Known gaps: stalled-stream cancellation, cross-session run ownership, failed provider runs, OAuth completion/expiry, v2 persistence across restart, generated-schema drift, real provider contracts, legacy jobs/RAG/memory/files, and browser E2E flows.
- Frontend tests verify shell presence and navigation only; they do not verify chat, credentials, SSE, or API error handling.
- The API tests verify successful paths more heavily than failure/cancellation paths.

## 6) Evidence

- `pyproject.toml`
- `tests/conftest.py`
- `tests/test_api_contract.py`
- `tests/test_provider_adapters.py`
- `frontend/src/App.test.tsx`
- `frontend/vitest.config.ts`
- `.github/workflows/ci.yml`
