# Technology Stack

| Area | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, Uvicorn, Pydantic, MCP Python SDK, jsonschema |
| Frontend | React 19, TypeScript 5.9, Vite, Tailwind CSS, Base UI |
| Persistence | stdlib SQLite and ChromaDB |
| Local inference | Ollama |
| Cloud inference | Ollama Cloud, OpenAI, Agnes AI, Anthropic, Google GenAI, OpenRouter, xAI, OpenCode Zen/Go |
| Subscription sign-in | Local OpenCode server bridge for available upstream OAuth methods |
| Search and files | DDGS, pypdf, python-docx, pandas/openpyxl/xlrd, Pillow |
| Python tooling | uv, pytest, Ruff |
| Frontend tooling | npm, Vitest, Testing Library, Oxlint, openapi-typescript |

Key commands:

```powershell
uv sync --locked --dev
cd frontend; npm ci --legacy-peer-deps; npm run build; cd ..
uv run chat-studio
uv run python -m pytest -q
uv run ruff check backend tests
cd frontend; npm run lint; npm test; npm run build
```

The local server binds to `127.0.0.1:8506`. Vite's development proxy targets the
same origin. Settings **Stop Studio** posts to `/api/v1/runtime/shutdown`.
Configuration uses `CHAT_` environment variables plus provider-specific key
variables. SQLite has no ORM.

`Launch Chat Studio.cmd` is the one-file Windows entrypoint. It fingerprints
`pyproject.toml` and `uv.lock`, installs missing portable runtimes/dependencies, and
uses `uv run --no-sync` when setup is current. Model-rate metadata comes from official
provider documentation or OpenRouter's live Models API.
