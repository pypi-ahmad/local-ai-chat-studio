# Local AI Chat Studio — User Guide

## Start the studio

On Windows 11, double-click **Launch Chat Studio.cmd** in the repository root. The
launcher installs missing portable runtimes and dependencies, builds the browser client
when needed, starts the server, and opens <http://127.0.0.1:8506>. Its console remains
open for logs; press Ctrl+C to stop. Run `Launch Chat Studio.cmd --check` from a terminal
for a non-installing status report.

Both launchers treat port `8506` as Studio-owned. They request a graceful shutdown
from an existing Studio, then terminate any process still listening on that port
before starting a fresh server. Use `--check` first if the port may belong to another
application. Setup fingerprints prevent unchanged Python packages, npm packages, and
frontend assets from being rebuilt on later launches.

On a mainstream glibc Linux desktop (x86_64 or ARM64), run:

```bash
./Launch\ Chat\ Studio.sh
```

If the executable bit was lost, use `bash 'Launch Chat Studio.sh'`. The launcher
installs portable runtimes under `.runtime/`, reuses current dependencies and builds,
starts the server in the foreground, and opens the browser through `xdg-open` or
`gio`. It never uses `sudo`. Run `bash 'Launch Chat Studio.sh' --check` for a
non-installing report. Bash, `tar` with xz support, `curl` or `wget`, and one of
`fuser`, `lsof`, or `ss` for port-owner discovery are required;
Alpine/musl is not supported by the portable Node.js setup.

For manual or development setup, build the browser client once and launch the server:

```powershell
cd frontend
npm ci
npm run build
cd ..
uv run chat-studio
```

Open <http://127.0.0.1:8506>.

## Main workflows

### Chat

Create or select a conversation, choose a discovered model, and send a message. The
answer streams live and **Stop** cancels the active provider request. Hover messages to
copy, branch from that point, or rate an answer. Conversation controls support rename,
pin, delete, and text search.

Files and images attached to the current conversation are included only when the
selected provider's data policy permits them. Vision-capable providers receive images
in their native format.

### Context and Evidence

Every turn gets a preflight plan. The context rail shows estimated input against an
80% safe budget, reserving the rest for output. Oversized plans shed lower-priority
sources automatically.

The **Evidence** page lists each source, its kind, token estimate, trust status,
origin, and URL when available. Clear its checkbox to exclude it from a pending send.
Suspicious retrieved instructions are quarantined automatically.

When a prompt may contain a key or personal information, the app pauses. You can
confirm the original text or use **Redact private text** and preflight again.

### Context backpacks and Focus

Use **Context** to save deliberate facts or constraints as a reusable backpack. Use
**Focus** to attach a temporary objective, completion criteria, and boundaries to the
current conversation.

### Replay and Compare

**Compare** sends the same prompt to two to four distinct models concurrently. Add
or remove model slots, watch each response stream independently, and use **Cancel
all** to stop active comparison runs. A provider failure is shown on its own result
card without stopping the other models. **Replay** records completed runs, lets you
run one again, diff two answers, and export either:

- a full local bundle containing the exact request and context; or
- a redacted share bundle with private context and image bytes removed.

Each completed run also carries a hash chained to the previous receipt.

### Providers

Paste a provider key to keep it in memory for the browser session, or use a matching
environment variable. Cloud providers begin with prompt-only access. Enable memory,
retrieval, attachments, web search, or backpacks separately for each provider.

Ollama Local needs no key; Ollama Cloud, OpenCode Zen, and OpenCode Go accept keys.
Agnes AI uses `AGNES_API_KEY` and discovers `agnes-2.5-flash` from its
OpenAI-compatible endpoint. See the [Agnes overview](https://www.agnes-ai.com/en/docs/overview)
and [Agnes 2.5 Flash model documentation](https://www.agnes-ai.com/en/docs/agnes-25-flash).
OpenAI optionally uses `OPENAI_BASE_URL`; prices are not assumed when that URL points
to a custom gateway.
Run an OpenCode server on loopback to expose its ChatGPT, SuperGrok, or Claude sign-in
methods in the Providers page. Anthropic also discovers configured workload identity.

**Test failover** simulates a rate limit and shows whether the configured fallback
path recovers, without spending tokens or making a provider request.

The model selector includes source-backed standard input/output rates per million
tokens when known. After context preflight, the budget rail estimates prompt cost.
Follow the **official source** link beside the selected model for the published rate;
the estimate does not include output, cached tokens, tools, media, discounts, taxes,
or subscription charges.

### Library

The Library contains memories, assistants, and files. **Save memories & close** asks
the selected model to reduce the whole chat to durable user facts and preferences,
stores only supported points in SQLite, and records their source messages. A cloud
model requires confirmation before the transcript is sent. Memories that resemble
prompt injection start quarantined; review and approve, archive, pin, or delete them.
Saved assistants retain a system prompt, model preference, and temperature.

### Settings and data controls

Settings shows FastAPI/Ollama status and loaded VRAM models. It also lets you edit the
local personalization profile, export or import JSONL, import an older
`data/v2/studio.db`, and panic-wipe workspace data. The v2 import is opt-in, backs up
`data/app.db`, and is idempotent. Panic wipe requires an explicit browser confirmation.

**Stop Studio** on the Runtime card cancels active model runs, then stops the
managed `chat-studio` process. Ollama and any local OpenCode server keep running.
Use it when you started the app from the launcher or `uv run chat-studio`. The
button is unavailable if the API is running in an unmanaged process (for example
a test client). After a successful stop, you can close the browser tab.

## Privacy defaults

- Chats, memories, files, receipts, and policies remain in `data/`.
- Browser-entered keys live only in process memory and are not exported.
- Remote providers receive only the prompt until you grant additional context classes.
- Web search is opt-in and sends the query to DuckDuckGo.
- The app has no login system; keep it bound to a trusted localhost.

## Troubleshooting

| Symptom | Check |
|---|---|
| No models in the picker | Start Ollama or connect a provider key, then reload |
| Ollama is offline | Run `ollama serve` or set `CHAT_OLLAMA_HOST` |
| No vector results | Set `CHAT_EMBED_MODEL` to an installed embedding model |
| First local response is slow | Check the VRAM list in Settings; the model may be loading |
| A provider key vanished | Session keys are intentionally forgotten on server restart |
| Stop Studio is unavailable | Start the app with the launcher or `uv run chat-studio`, not an unmanaged server |
| An old `.doc` has no text | Install LibreOffice or `antiword` |
