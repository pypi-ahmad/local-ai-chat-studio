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
simulation, deterministic history compression with recent-turn retention, pricing
catalog matching/live OpenRouter normalization, profile, runtime health, and managed shutdown (header required,
unmanaged servers return 503).

Frontend tests use Vitest, Testing Library, jest-dom, and jsdom. They exercise the
connected workspace shell, semantic desktop/mobile navigation groups, persisted and
keyboard-dismissible context/evidence inspection, bounded transcript navigation,
top/bottom jumps, and unread streamed-output signaling,
context utilization and overflow states, preflight, SSE output, the OpenCode Claude
sign-in affordance, searchable capability-aware model selection, favorites, recents,
tool-use filtering, provider marks, and rate display,
attachment upload/processing/completion/error states, metadata, retry, and durable removal,
parallel comparison across three models,
composer control grouping, context/temperature/web-evidence/compression request mapping,
per-conversation settings hydration, system-prompt persistence, and layout changes,
four-model partial failure isolation, cancel-all behavior, and the Settings **Stop
Studio** control. There is no browser E2E
runner or coverage threshold yet; real external-provider calls, OAuth flows, and a
running Ollama daemon remain manual smoke tests.

Provider adapter tests also lock the `gpt-5.6-luna` request contract: its OpenAI-
compatible request must omit a custom temperature and use the model default.
