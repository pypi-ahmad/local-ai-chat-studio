# Testing Patterns

```powershell
uv run python -m pytest -q
uv run ruff check backend tests
cd frontend
npm run lint
npm test
npm run build
```

Backend tests use FastAPI `TestClient`, in-memory SQLite, injected adapters, and the
echo provider. They cover API contracts, session-owned runs, cancellation behavior,
legacy schema compatibility, safety confirmation/redaction, context policy and
pruning, provenance/exclusions, replay/diff/bundles, data controls, v2 import, files,
images, selected per-turn attachments, whole-chat memory curation/provenance, local and
cloud Ollama behavior, OpenCode loopback validation, focus/backpacks, provider
simulation, profile, and runtime health.

Frontend tests use Vitest, Testing Library, jest-dom, and jsdom. They exercise the
connected workspace shell, navigation, preflight, SSE output, and the OpenCode Claude
sign-in affordance. There is no browser E2E runner or coverage threshold yet; real
external-provider calls, OAuth flows, and a running Ollama daemon remain manual smoke
tests.
