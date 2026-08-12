# Local AI Chat Studio — User Guide

## Start the studio

Build the browser client once, then launch the local server:

```powershell
cd frontend
npm ci
npm run build
cd ..
uv run chat-studio
```

Open <http://127.0.0.1:8000>.

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

**Compare** streams the same prompt through two models. **Replay** records completed
runs, lets you run one again, diff two answers, and export either:

- a full local bundle containing the exact request and context; or
- a redacted share bundle with private context and image bytes removed.

Each completed run also carries a hash chained to the previous receipt.

### Providers

Paste a provider key to keep it in memory for the browser session, or use a matching
environment variable. Cloud providers begin with prompt-only access. Enable memory,
retrieval, attachments, web search, or backpacks separately for each provider.

**Test failover** simulates a rate limit and shows whether the configured fallback
path recovers, without spending tokens or making a provider request.

### Library

The Library contains memories, assistants, and files. Memories that resemble prompt
injection start quarantined; review and approve, archive, pin, or delete them. Saved
assistants retain a system prompt, model preference, and temperature.

### Settings and data controls

Settings shows FastAPI/Ollama status and loaded VRAM models. It also lets you edit the
local personalization profile, export or import JSONL, import an older
`data/v2/studio.db`, and panic-wipe workspace data. The v2 import is opt-in, backs up
`data/app.db`, and is idempotent. Panic wipe requires an explicit browser confirmation.

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
| An old `.doc` has no text | Install LibreOffice or `antiword` |
