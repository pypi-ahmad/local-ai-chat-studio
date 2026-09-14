# Runbook

Operational reference for running, stopping, and troubleshooting Local AI Chat
Studio. All facts below are drawn from the launch scripts and from
`backend/app/*.py` / `src/*.py` source (error strings, imports, and logging
calls), not from external documentation. See
[TECHNICAL.md](../TECHNICAL.md) for the architecture and
[docs/codebase/ARCHITECTURE.md](codebase/ARCHITECTURE.md) for data flow.

## Starting the Studio

The server always binds to `127.0.0.1:8506` (`backend/app/cli.py`). Pick one:

| Method | Command | Notes |
| --- | --- | --- |
| Simple launcher (Windows) | `.\launch.cmd` | Requires `uv` and Node.js already on `PATH`. Runs `uv sync --locked`, builds the frontend once, then `uv run chat-studio`. |
| Simple launcher (Linux) | `bash launch.sh` | Same steps as above on Linux. |
| Self-contained launcher (Windows) | Double-click `Launch Chat Studio.cmd`, or `& '.\Launch Chat Studio.cmd' --check` for a status-only report | Installs portable `uv`/Node.js into `.runtime/` if missing, clears port `8506` of any prior listener, then starts the server and opens the browser. |
| Self-contained launcher (Linux) | `./Launch\ Chat\ Studio.sh` or `bash 'Launch Chat Studio.sh' --check` | glibc x86_64/ARM64 only (Ubuntu, Debian, Fedora, Arch); not supported on Alpine/musl. Needs `bash`, `tar` with xz, and `curl` or `wget`; needs `fuser`, `lsof`, or `ss` to identify a non-Studio process already on port 8506. |
| Manual | `uv sync --locked --dev && cd frontend && npm ci --legacy-peer-deps && npm run build && cd .. && uv run chat-studio` | For development or when you don't want either launcher managing setup. |
| Frontend dev mode | Backend: `uv run chat-studio`. Frontend: `cd frontend && npm run dev` | Vite dev server proxies `/api` to `http://127.0.0.1:8506`. |

Both `Launch Chat Studio.*` scripts persist a dependency/content fingerprint
only after a successful `uv sync`, `npm ci`, or frontend build, so a failed
run does not get skipped as "already set up" on the next attempt.

Ollama is optional: the Studio starts and runs fully on a configured cloud
provider if no local Ollama is present. `GET /api/v1/runtime/health` reports
`ollama_available` and `running_models` at any time.

## Stopping the Studio

- **From the UI**: Settings → **Stop Studio** sends
  `POST /api/v1/runtime/shutdown` with header `X-Local-Studio: shutdown`.
  This calls `RunManager.shutdown()` (cancels and awaits every in-flight
  run), then triggers the CLI's `shutdown_callback`, which sets
  `uvicorn.Server.should_exit = True` (`backend/app/cli.py`,
  `backend/app/main.py`).
- **From a launcher console**: `Ctrl+C`.
- **Process lifespan**: FastAPI's `lifespan` context (`backend/app/main.py`)
  runs the same run-drain and closes the SQLite connection
  (`store.connection.close()`) on any shutdown path, not just the managed one.
- Stopping the Studio does **not** stop Ollama or an external OpenCode
  server; those are separate processes the Studio only talks to.
- The self-contained launchers' normal (non-`--check`) launch clears port
  `8506` before starting: it first tries the managed shutdown API against
  whatever is listening there, then terminates any remaining process on that
  port. Use `--check` first if another, unrelated application might be using
  port 8506.

## Where logs go

There is no log file anywhere in this codebase: verified by grep, there is
no `logging.basicConfig(...)`, `RotatingFileHandler`, or `loguru.add(...)`
call in the repository.

- `backend/app/main.py` and `backend/app/workspace.py` use Python's standard
  `logging.getLogger(__name__)`. With no handler configured by the app, these
  records propagate to the root logger, which Uvicorn's default logging
  configuration (set up inside `uvicorn.Server(...).run()` in
  `backend/app/cli.py`) sends to the console the process is running in.
- `src/files.py`, `src/ollama_client.py`, and `src/rag.py` (the `src/`
  modules actually imported by `backend/app`) use `loguru`, whose default
  sink is `stderr`, also console-only, in the same terminal.
- To keep logs after the terminal closes, redirect the process's output
  yourself when launching manually, e.g. `uv run chat-studio >> studio.log
  2>&1` (bash) or `uv run chat-studio *>> studio.log` (PowerShell). Neither
  launch script does this for you.

## Common failures

Grounded in the actual `raise`/`HTTPException` call sites in
`backend/app/main.py`, `backend/app/mcp_tools.py`, and `backend/app/sessions.py`
via `backend/app/providers.py`.

### Startup

| Symptom | Cause | Fix |
| --- | --- | --- |
| `RuntimeError: Providers missing from PROVIDER_ENV: [...]` at startup | `create_app()` found a provider adapter id in `ProviderRegistry` with no matching entry in `backend/app/sessions.py`'s `PROVIDER_ENV` dict | Only relevant if you're adding a new provider adapter — add its credential env var name (or `None` for no-credential providers) to `PROVIDER_ENV`. |
| Port 8506 already in use, launcher exits or restarts a previous Studio | Another process (or a previous, un-stopped Studio) is bound to 8506 | Run the launcher's `--check` mode to see what owns the port before deciding; the self-contained launchers otherwise terminate it automatically on normal launch. |
| `pytest`/`ruff check backend tests` behave unexpectedly or find nothing | `tests/` is absent from the working tree even though it's tracked in Git (six files: `conftest.py` and five `test_*.py` modules) — confirmed by listing the directory directly, not just `git status` | `git restore tests` (or `git checkout -- tests`) to bring the tracked test files back before running checks. |

### Runs and turns

| Symptom (HTTP status, message) | Cause |
| --- | --- |
| `409`, `"Context changed"` | The context plan hash sent with a turn no longer matches a freshly rebuilt plan (history, attachments, or policy changed between preflight and send). Re-run preflight. |
| `422`, `"Context exceeds the safe budget"` | Estimated tokens exceed the plan's safe budget (80% warning threshold, blocked over 100%). Reduce context or pick a larger-context model. |
| `409`, `"Confirmation required"` | One or more safety findings (secret/PII/prompt-injection pattern from `scan_text` in `backend/app/workspace.py`) were not included in `confirmed_finding_ids`. |
| `422`, `"Selected model does not support image input"` | An image attachment was selected for a model whose discovered capabilities don't include `vision`. |
| `404`, `"Conversation or context backpack not found"` | The conversation, an attachment id, or a referenced backpack no longer exists. |

### Providers

| Symptom | Cause |
| --- | --- |
| `404`, `"Provider not found"` | Provider id isn't in `ProviderRegistry.adapters` (typo, or a provider removed from `build_provider_registry()`). |
| `400`, `"Provider does not accept API keys"` | Tried to `PUT` a credential for a provider whose `auth_modes` doesn't include `api_key` (e.g. `opencode-bridge`, or local Ollama). |
| `RunSnapshot.status == "failed"`, generic `"Provider request failed (<ExceptionType>)"` | Any non-`ValueError`/`KeyError` exception from a provider adapter's `stream()` is reduced to this generic message by `RunManager._safe_error` so raw provider errors and credentials never reach a persisted run record. Check server console output for the real exception at the time it happened (see "Where logs go"). |
| `502`/`404` on `/providers/opencode-bridge/*` | No OpenCode server is reachable at `OPENCODE_SERVER_URL` (default `http://127.0.0.1:4096`), or that URL isn't a loopback address (`OpenCodeBridgeAdapter.__init__` raises `ValueError` for non-loopback hosts at construction time). |
| `409`, `"No OpenRouter authorization is pending"` / `502` on OpenRouter callback | The PKCE verifier for that session expired (>600s, see `OAUTH_VERIFIER_TTL`) or the code was already exchanged. Restart the OpenRouter sign-in flow. |

### Uploads and MCP

| Symptom | Cause |
| --- | --- |
| `415`, `"File type not supported"` | Extension not in `ACCEPTED_TYPES` (`src/files.py`: images `png/jpg/jpeg/webp/gif/bmp`, documents `pdf/txt/md/csv/tsv/docx/doc/json/py/log/yaml/yml/toml/html/xlsx/xlsm/xls`). |
| `413`, `"File exceeds the 10 MB limit"` | Upload body over 10 MB after base64 decoding. |
| `422`, `"File could not be parsed"` | `parse_upload()` raised (e.g. image content doesn't match its extension, invalid PDF signature, corrupt document). |
| Legacy `.doc` text comes back empty, log line `"No .doc converter available (install antiword or libreoffice)"` | Neither `antiword` nor `soffice` (LibreOffice) is on `PATH`. Install one of them to extract text from old binary `.doc` files. |
| `504`, `"MCP discovery timed out"` | The stdio process or remote server didn't respond within 30 seconds (hardcoded in `backend/app/mcp_tools.py`). |
| `502`, `"MCP server discovery failed"` | Discovery raised an exception other than `ValueError`/`TimeoutError` (bad command, unreachable URL, protocol error). |
| `ValueError: "Remote MCP servers require an HTTPS URL"` / `"...resolves to a private or reserved address"` | A registered remote MCP server URL isn't public HTTPS, or its hostname resolves to a private/loopback/reserved IP — rejected by design (`_public_remote_url`). |
| `409` on tool approve/deny | The tool request was already claimed/decided (single-use approval transition). |

### Data

| Symptom | Cause |
| --- | --- |
| `404`, `"No v2 database is available to import"` | `POST /api/v1/data/import-v2` ran but no `data/v2/studio.db` file exists. |
| `422` on `/data/import-v2` | The v2 database exists but its schema/content didn't validate for import. |
| `422`, `"Export format must be markdown, html, txt, or json"` | Requested an unsupported value for `{export_format}`. |
| `503`, `"Server shutdown is unavailable in unmanaged mode"` | `POST /api/v1/runtime/shutdown` was called against a server not started with a `shutdown_callback` (e.g. a raw `create_app()` in tests) — expected in that mode, not a bug. |
| `403`, `"Shutdown request was not issued by the local Studio UI"` | Shutdown request missing the required `X-Local-Studio: shutdown` header. |

## Data locations

- `data/app.db`: canonical SQLite store (conversations, messages, runs, memories,
  presets, uploads metadata, knowledge bases, MCP servers/tools/requests, etc.)
- `data/chroma`: optional vector collections (only populated when `CHAT_EMBED_MODEL`
  is set)
- `data/uploads`: local uploaded-file bytes
- `data/mcp-sandboxes/<server-id>`: isolated working directory per local stdio MCP server
- `data/v2/studio.db`: optional legacy v2 database, imported explicitly from Settings

`CHAT_DATA_DIR` relocates the whole `data/` root (default: `data`, relative to
the project root).
