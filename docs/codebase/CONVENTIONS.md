# Coding Conventions

- Python modules/functions use `snake_case`; types use `PascalCase`; constants use
  uppercase `SNAKE_CASE`.
- React components use `PascalCase`, values and callbacks use `camelCase`, and shared
  UI imports use the `@/` alias.
- Keep `App.tsx` focused on session/API orchestration. Put page composition in
  `routes/`, reusable domain behavior in `features/`, browser hooks in `hooks/`, and
  generated or handwritten HTTP/SSE boundaries in `api/`.
- Backend conversation settings are authoritative persisted state. Keep transient
  component state local and browser-only shell preferences behind
  `useWorkspacePreferences`/`state` helpers.
- FastAPI contracts live in `contracts.py`; regenerate `frontend/src/api/schema.ts`
  after changing them.
- Route handlers translate missing domain objects to 404. Run failures expose a safe
  category, not raw provider exception text.
- Credentials must never be logged, persisted, included in replay bundles, or returned
  by provider APIs.
- Use `create_app(database_url=":memory:")`, the deterministic echo provider, and
  injected adapters for isolated backend tests.
- Ruff checks `backend` and `tests`; Oxlint, Vitest, and TypeScript/Vite check the
  frontend. No repository-wide formatter is configured.
