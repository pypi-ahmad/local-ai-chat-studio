Repository: https://github.com/pypi-ahmad/local-ai-chat-studio

# Local AI Chat Studio

A ChatGPT-style AI tool centered on your **local Ollama models**, with optional
bring-your-own-key cloud providers. Streamlit UI, SQLite + ChromaDB storage —
your chats, memory, and API keys never leave your machine.

<p>
  <img alt="Python" src="https://img.shields.io/badge/python-3.12-blue.svg">
  <img alt="Streamlit" src="https://img.shields.io/badge/UI-Streamlit-FF4B4B.svg">
  <img alt="Ollama" src="https://img.shields.io/badge/LLM-Ollama-black.svg">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

> 100% local by default. Cloud providers are entirely optional and opt-in — add a
> key only if you want them. Built to keep working unchanged as you pull new models
> or upgrade your hardware: every model list is discovered live at runtime.

## Features

- **Auto-discovered models** — the dropdown is populated live from Ollama's API
  (local **and** `:cloud` models) plus every connected provider's models endpoint.
  Pull or release a new model anywhere, hit ⟳, it appears with an auto-generated
  use hint (e.g. `gemma4:12b — vision, reasoning · strongest, slower`). No code
  changes, ever. Hints derive from API metadata: capabilities (vision/thinking/
  tools), name patterns (coder/OCR/medical/translation), and size tiers.
- **BYOK cloud providers** (Providers page) — OpenAI, Anthropic, OpenRouter,
  xAI (Grok), and Google Gemini, grouped by provider in the model dropdown with a
  provider filter. Paste an API key (or set the env var), or for OpenRouter log in
  with your account (OAuth PKCE). Anthropic uses the official `anthropic` SDK; the
  rest use their OpenAI-compatible endpoints.
  🔒 **Keys are held only in server memory for the session** — never written to
  disk, logged, or exported, and sent only to the provider they belong to.
  Restarting forgets them; env vars work as a read-only fallback.
- **Ollama Cloud / remote (no local install needed)** — on the Providers page,
  point the Ollama endpoint at `ollama.com` (or a remote server) and paste an
  Ollama API key to run entirely in the cloud.
- **File & image uploads** in the chat box:
  - Images go straight to vision models (local or cloud); for text-only models
    they're automatically read by your best local vision/OCR model and injected
    as text.
  - Documents (PDF/docx/doc/xlsx/xls/txt/md/csv/...) are injected directly if
    small, or chunked + embedded + retrieved per-question (RAG) if large.
    Excel parses every sheet; legacy `.doc` needs `antiword` or LibreOffice.
- **Non-blocking generation** — replies run in a background thread, so you can
  start another chat, open Settings, or browse while an answer keeps streaming.
  The sidebar shows ⏳ for running conversations and the finished reply is saved
  even if you navigate away.
- **Configurable Ollama endpoint** — defaults to local `localhost:11434`; point it
  at a remote or hosted Ollama (with an optional Bearer key) from the Providers page.
- **Saved chats** — every message persists to SQLite instantly; conversations are
  auto-titled by a small local model; reopening a chat restores its model.
  Wipe them all from **Settings → Clear all chats** (memories are kept).
- **Cross-chat references** — past conversations are embedded into ChromaDB; relevant
  snippets are retrieved into new chats ("🔗 referencing: _Fraud Detection Models_").
- **ChatGPT-style memory** — durable facts about you are extracted after conversations,
  deduplicated by embedding similarity, and injected when relevant. Manage them on the
  **Memory** page (edit / pin / archive / delete).
- **Self-improving personalization** — a rolling user profile (expertise, style,
  preferences) is rebuilt periodically from your chats and 👍/👎 feedback, and shapes
  every system prompt. Unused memories decay; pinned ones never do.
- **Future fine-tuning ready** — export all chats as JSONL from Settings for a
  QLoRA personalization run when hardware allows.

## Privacy & security

- **API keys never touch disk.** Provider and Ollama-cloud keys live only in the
  running server's process memory for the session. They are never written to a
  file, logged, or included in chat exports, and are sent only to the provider
  they belong to. Restarting the app forgets them.
- **Read-only env fallback.** If you'd rather not retype keys each launch, set
  them as environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `OPENROUTER_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_API_KEY`). The
  app reads them but never writes them.
- **One-click wipe.** The Providers page has per-key **Forget** and a global
  **🧹 Forget all keys** control; password fields keep keys off the screen.
- **Everything else stays local.** Chats, memories, and vectors live in `data/`
  (SQLite + ChromaDB) on your machine. The app has no telemetry and no login —
  only expose it beyond `localhost` on a network you trust.

## Model picker

The sidebar has a **Provider filter** (`🌐 All`, `🦙 Ollama (local)`,
`☁️ Ollama (cloud)`, then each connected cloud provider) above the model
dropdown. In **All** mode every model is grouped and badge-prefixed by provider;
picking a single provider narrows the list — handy for providers like OpenRouter
that expose hundreds of models. Hit ⟳ any time to re-fetch every list.

## Requirements

| What | Why | Check |
|---|---|---|
| [Ollama](https://ollama.com/download) running locally | Serves all local models | `ollama --version` |
| At least one chat model | Something to talk to | `ollama list` |
| An embedding model | Memory, cross-chat references, RAG over big files | `ollama pull embeddinggemma` |
| Python 3.12 + [uv](https://docs.astral.sh/uv/) | Runs the app | `uv --version` |
| *(optional)* LibreOffice or `antiword` | Legacy `.doc` upload parsing | `which soffice antiword` |
| *(optional)* Ollama account | `:cloud` models (run on ollama.com) | `ollama signin` |

## How to run

### First-time setup

```bash
# 1. Clone the repository
git clone https://github.com/pypi-ahmad/local-ai-chat-studio.git
cd local-ai-chat-studio

# 2. Make sure Ollama is up (usually already running as a service)
ollama serve            # skip if `ollama list` already works

# 3. Pull an embedding model once — enables memory + RAG
ollama pull embeddinggemma

# 4. Install dependencies into the project venv
uv sync
```

### Start the app

```bash
uv run streamlit run app.py
```

Then open **http://localhost:8501** (Streamlit prints the exact URL; use
`--server.port 8503` to pick a fixed port). Stop with `Ctrl+C`.

### First things to try

1. Pick a model — use the **Provider filter** to jump to a provider, then choose
   a model from the grouped dropdown (hints tell you what each is good at).
2. Type a message; attach files or images with the 📎 in the message box.
3. *(optional)* Open **Providers** and add an OpenAI / Anthropic / OpenRouter /
   xAI / Gemini API key (or set the Ollama endpoint to cloud) — models join the
   dropdown after a ⟳ refresh.
4. After a few chats, check the **Memory** page to see what it has learned.

### Run on a fixed port, reachable from your LAN (optional)

```bash
uv run streamlit run app.py --server.port 8503 --server.address 0.0.0.0
```

> ⚠️ The app has no login — only expose it beyond `localhost` on a network you trust.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot reach Ollama" banner | Start Ollama: `ollama serve` (or `systemctl start ollama`) |
| "No embedding model — memory & RAG off" | `ollama pull embeddinggemma`, then ⟳ in the sidebar |
| New model not in dropdown | Click ⟳ (model lists are cached 1–5 min) |
| `:cloud` model returns 403 | That model needs an Ollama subscription, or run `ollama signin` |
| First reply very slow | Ollama is swapping models in 8 GB VRAM — later replies are fast |
| `.doc` upload extracts nothing | Install LibreOffice (`sudo apt install libreoffice`) or `antiword` |
| Provider key gone after restart | By design — keys are session-only. Re-enter on **Providers**, or set the env var (e.g. `OPENROUTER_API_KEY`) for a read-only fallback |
| No local Ollama at all | On **Providers** → Ollama endpoint, click **Use Ollama Cloud** and paste an Ollama API key |
| Too many models in the dropdown | Use the **Provider filter** above it to narrow to one provider |

## Configuration

Defaults live in `src/config.py`; override any of them with `CHAT_`-prefixed env vars
(or a `.env` file), e.g. `CHAT_OLLAMA_HOST=http://192.168.1.5:11434`,
`CHAT_PROFILE_REFRESH_EVERY=10`.

All data (SQLite DB, Chroma vectors, uploads) lives in `data/` — delete it to reset.

## How the smart parts work

| Concern | Mechanism |
|---|---|
| Model labels | Rule-based on `/api/tags` metadata — works for models that don't exist yet |
| Helper tasks (titles, extraction, profile) | Smallest general-purpose local model ≥1 GB, auto-selected |
| Vision fallback | Smallest vision-capable model; OCR models by name as last resort |
| Memory dedup | Cosine similarity ≥ 0.88 against existing memories bumps usage instead of duplicating |
| Personalization | Profile rebuilt every N conversations from recent chats + rated answers |
| VRAM | One model in VRAM at a time (Ollama scheduler), `keep_alive` configurable |

## Project layout

```
local-ai-chat-studio/
├── app.py              # Streamlit entry point (chat UI)
├── pages/              # Memory, Settings, Providers pages
├── src/
│   ├── config.py       # Pydantic settings (env-overridable)
│   ├── ollama_client.py# Local + :cloud model discovery and streaming
│   ├── providers.py    # BYOK: OpenAI / Anthropic / OpenRouter / xAI / Gemini
│   ├── model_labels.py # Rule-based "use hint" generator
│   ├── files.py        # Upload parsing (PDF, Office, images, ...)
│   ├── rag.py          # ChromaDB indexing + retrieval
│   ├── memory.py       # Fact extraction, dedup, decay
│   ├── personalization.py # Rolling user profile
│   ├── orchestrator.py # Per-turn prompt assembly
│   └── chat_store.py   # SQLite persistence
└── data/               # SQLite DB, Chroma vectors, keys (git-ignored)
```

## Contributing

Contributions are very welcome — this is an open-source project and PRs, issues,
and ideas are always appreciated. 🙌

1. Fork the repo and create a feature branch: `git checkout -b feat/your-idea`.
2. Make your change. Keep it focused, and match the existing style (type hints,
   Google-style docstrings, `loguru` for logging).
3. Run the app locally and confirm your change works end to end.
4. Commit with a clear message and open a pull request describing the *why*.

Good first contributions: new file-type parsers, additional BYOK providers,
better model-hint heuristics, UI polish, or tests. Found a bug or have a feature
request? [Open an issue](https://github.com/pypi-ahmad/local-ai-chat-studio/issues).

## License

Released under the [MIT License](LICENSE) — free to use, modify, and share.
