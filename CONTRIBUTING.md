# Contributing to Local AI Chat Studio

Contributions are welcome — PRs, issues, and ideas are all appreciated. This
guide covers the mechanics of contributing; for a deep dive into *how the code
works* before you change it, see the
[Zero-to-Hero Study Handbook](ZERO_TO_HERO_STUDY_HANDBOOK.md) (§10 has
step-by-step recipes for the most common contribution types: adding a v2
provider, adding an endpoint, wiring a React workspace slice, adding a legacy
file parser) and [CODE_TUTORIAL.md](CODE_TUTORIAL.md) for a narrative
walkthrough of the existing modules.

## Before you start

1. Fork the repo and create a feature branch: `git checkout -b feat/your-idea`.
2. Read [SECURITY.md](SECURITY.md) if your change touches credentials,
   sessions, or anything network-facing.
3. Check [open issues](https://github.com/pypi-ahmad/local-ai-chat-studio/issues)
   and the README's [Roadmap](README.md#roadmap) so you're not duplicating
   in-flight work.

## Setup

Follow [USER_GUIDE.md §2](USER_GUIDE.md#2-clone-set-up-and-run-it) to get the
app running locally. For backend + frontend development together:

```bash
uv sync --locked --dev
cd frontend && npm ci && cd ..
```

## Code style

- **Python**: type hints throughout, Google-style docstrings, `loguru` for
  logging (not `print`). Match the existing pattern in the file you're
  editing — legacy `src/`/`app.py`/`pages/` and v2 `backend/app/` have
  slightly different conventions; follow whichever stack you're touching.
- **TypeScript/React**: match `frontend/src/components/ui/` conventions
  (shadcn-style primitives) for new UI components; `frontend/.oxlintrc.json`
  is the linter config.
- Keep changes focused — a bug fix shouldn't also refactor unrelated code.

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
   regenerate the frontend types: `uv run python scripts/generate_api_types.py`
   (or `npm run generate:api` from `frontend/`) and commit the diff to
   `frontend/src/api/schema.ts`.
4. Add or update tests for the behavior you changed — `tests/` for the v2
   backend, alongside the module for legacy `src/` code.

## Good first issues

New file parsers (`src/files.py`), more BYOK providers (legacy
`src/providers.py` or v2 `backend/app/providers.py`), model-hint heuristics
(`src/model_labels.py`), tests for the legacy stack (currently thin — see
handbook §11.1), and UI polish on the v2 frontend.

Found a bug but don't have time to fix it?
[Open an issue](https://github.com/pypi-ahmad/local-ai-chat-studio/issues) —
include reproduction steps and, if you can, the affected file/line.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Be kind.
