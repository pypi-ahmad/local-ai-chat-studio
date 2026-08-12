# Local AI Chat Studio

A local-first AI workspace built with FastAPI and React. It connects to Ollama by
default and supports optional session-scoped keys for Ollama Cloud, OpenAI,
Anthropic, Gemini, OpenRouter, xAI, OpenCode Zen/Go, and compatible gateways.

## What is included

- Streaming chat, cancellation, branching, pinning, rename, search, and feedback
- Side-by-side model comparison and replay with answer diffs
- A context budget meter with automatic pruning and per-source exclusions
- Provenance for history, memory, retrieval, files, web results, and integrity receipts
- Prompt-injection quarantine plus secret/PII warnings and one-click redaction
- Local context backpacks and temporary focus contracts
- Provider data-boundary policies and deterministic failover simulation
- PDF, Office, text, spreadsheet, code, and provider-native image inputs
- Full local replay bundles and redacted bundles safe to share
- Memory, assistants, personalization profile, runtime/VRAM health, and data controls
- LLM-curated SQLite memory with source-message provenance and optional Chroma indexing
- ChatGPT, SuperGrok, and Claude subscription sign-in through a local OpenCode server

Cloud providers start in prompt-only mode. Credentials entered in the browser stay in
server-process memory for that browser session and are never exported.

## Install and run

Requirements: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node.js, and optionally
[Ollama](https://ollama.com/) for local models.

On Windows 11, double-click **Launch Chat Studio.cmd**. It installs missing portable
runtimes and locked dependencies inside the project, builds the frontend when needed,
starts the server, and opens the browser. Ollama remains optional.

For manual or development setup:

```powershell
git clone https://github.com/pypi-ahmad/local-ai-chat-studio.git
cd local-ai-chat-studio
uv sync --locked --dev
cd frontend
npm ci
npm run build
cd ..
uv run chat-studio
```

Open <http://127.0.0.1:8000>. For frontend development, run `npm run dev` in
`frontend`; Vite proxies `/api` to the backend.

## Data and migration

The canonical stores are `data/app.db` and `data/chroma`. Existing legacy data in
`data/app.db` is used in place. If an earlier React preview created
`data/v2/studio.db`, import it explicitly from **Settings**; the app creates a backup
of `app.db` first and records the migration so a repeat import is a no-op.

Set `CHAT_EMBED_MODEL` to an installed Ollama embedding model to use the existing
Chroma index. Without it, cross-chat retrieval falls back to local lexical search.

Common environment variables:

| Variable | Purpose |
|---|---|
| `CHAT_DATA_DIR` | Data directory; defaults to `data` |
| `CHAT_OLLAMA_HOST` | Ollama endpoint; defaults to `http://localhost:11434` |
| `CHAT_EMBED_MODEL` | Ollama embedding model used with Chroma |
| `OLLAMA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY` | Read-only credential fallbacks |
| `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY` | Compatible gateway endpoint and credential fallback |
| `OPENCODE_ZEN_API_KEY`, `OPENCODE_GO_API_KEY` | OpenCode inference API fallbacks |
| `OPENCODE_SERVER_URL` | Local OpenCode server; defaults to `http://127.0.0.1:4096` |
| `OPENCODE_SERVER_USERNAME`, `OPENCODE_SERVER_PASSWORD` | Optional OpenCode server basic authentication |

## Architecture

```text
frontend/src/          React workspace and typed API client
backend/app/main.py    FastAPI routes, session boundary, and static frontend
backend/app/runs.py    Async run lifecycle, SSE events, cancellation, receipts
backend/app/workspace.py  Safety scan, context planning, retrieval, web evidence
backend/app/store.py   Legacy-compatible SQLite persistence and data controls
backend/app/providers.py Provider adapters and live model discovery
src/files.py           Document and image parsing
src/rag.py             Existing Chroma collections and retrieval helpers
data/                  Local runtime state
```

## Verification

```powershell
uv run python -m pytest -q
uv run ruff check backend tests
cd frontend
npm run lint
npm test
npm run build
```

## Documentation

- [USAGE.md](USAGE.md) — quick task-based user guide
- [USER_GUIDE.md](USER_GUIDE.md) — complete product workflows
- [TECHNICAL.md](TECHNICAL.md) — concise developer architecture and configuration guide
- [CODE_TUTORIAL.md](CODE_TUTORIAL.md) and [the offline Zero-to-Hero handbook](docs/tutorial/index.html) — deeper guided tours
- [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — contribution expectations
- [SECURITY.md](SECURITY.md) — security model and private vulnerability reporting
- [CHANGELOG.md](CHANGELOG.md) — release history

## Security

The server binds to localhost and has no user-account layer. Do not expose it to an
untrusted network. Report vulnerabilities through [SECURITY.md](SECURITY.md).

Released under the [MIT License](LICENSE).
