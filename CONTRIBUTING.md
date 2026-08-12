# Contributing to Local AI Chat Studio

Contributions are welcome — PRs, issues, and ideas are all appreciated. This
guide covers the mechanics of contributing. Start with
[TECHNICAL.md](TECHNICAL.md) and the current architecture map in
[`docs/codebase/`](docs/codebase/); the longer handbook and code tutorial retain
some clearly marked historical Streamlit material.

## Before you start

1. Fork the repo and create a feature branch: `git checkout -b feat/your-idea`.
2. Read [SECURITY.md](SECURITY.md) if your change touches credentials,
   sessions, or anything network-facing.
3. Check [open issues](https://github.com/pypi-ahmad/local-ai-chat-studio/issues)
   and the README's [Roadmap](README.md#roadmap) so you're not duplicating
   in-flight work.

## Setup

Follow [USAGE.md](USAGE.md) to get the app running locally. For backend +
frontend development together:

```bash
uv sync --locked --dev
cd frontend && npm ci && cd ..
```

## Code style

- **Python**: type hints throughout and no `print` debugging. Match the existing
  pattern in `backend/app/` or the shared helper under `src/` that you touch.
- **TypeScript/React**: match `frontend/src/components/ui/` conventions
  (shadcn-style primitives) for new UI components; `frontend/.oxlintrc.json`
  is the linter config.
- Keep changes focused — a bug fix shouldn't also refactor unrelated code.
- Update the relevant English documentation when user-visible behavior,
  configuration, security boundaries, or API contracts change.

## Running checks before you open a PR

```bash
uv run python -m pytest -q
uv run ruff check backend tests
cd frontend
npm run lint
npm test
npm run build
```

These are the same checks CI (`.github/workflows/ci.yml`) runs on every PR —
green locally means green in CI.

## Opening a PR

1. Run the app and verify your change end-to-end (not just unit tests).
2. Open a PR describing *why*, not just *what* — link any related issue.
3. If you touched `backend/app/contracts.py` (any request/response shape),
   regenerate the frontend types with `npm run generate:api` from `frontend/`,
   remove the temporary root `openapi.json`, and commit the diff to
   `frontend/src/api/schema.ts`.
4. Add or update tests for the behavior you changed under `tests/`.

## Good first issues

New file parsers (`src/files.py`), more BYOK providers
(`backend/app/providers.py`), retrieval improvements, and React workspace polish.

Found a bug but don't have time to fix it?
[Open an issue](https://github.com/pypi-ahmad/local-ai-chat-studio/issues) —
include reproduction steps and, if you can, the affected file/line.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Be kind.
