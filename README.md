# Local AI Chat Studio

**A local-first AI studio with a FastAPI + React workspace, Ollama, optional BYOK
cloud providers, session-isolated credentials, streaming runs, memory, assistants,
and model comparison.**

<p>
  <a href="https://www.python.org/"><img alt="Python" src="https://img.shields.io/badge/python-3.12-blue.svg"></a>
  <a href="https://streamlit.io/"><img alt="Streamlit" src="https://img.shields.io/badge/UI-Streamlit-FF4B4B.svg"></a>
  <a href="https://ollama.com/"><img alt="Ollama" src="https://img.shields.io/badge/LLM-Ollama-black.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg"></a>
  <a href="#contributing"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"></a>
</p>

<img src="docs/screenshot-chat.png" alt="Chat Studio — dark theme with the built-in Coding Agent" width="85%">

## Table of Contents

- [Background](#background)
- [Features](#features)
- [Screenshots](#screenshots)
- [Learning guide](#learning-guide)
- [Setup](#setup)
- [Usage](#usage)
- [Configuration](#configuration)
- [Privacy and Security](#privacy-and-security)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Background

Most AI chat tools make you choose: a polished cloud app that reads your data, or a
local toy that forgets everything between messages. Chat Studio is built around three
promises:

1. **Local-first** — runs entirely against your own Ollama by default. Cloud
   providers are opt-in, per key, per session.
2. **Zero-maintenance** — every model list is discovered live at runtime. Pull a new
   model, refresh, done. No config edits when you upgrade your hardware or a
   provider ships a new model.
3. **It knows you** — ChatGPT-style long-term memory, cross-conversation references,
   and a personalization profile that improves the more you chat.

## Features

| | Feature | Details |
|---|---|---|
| 🧠 | **Long-term memory** | Durable facts are extracted from chats, deduplicated by embedding similarity, and injected when relevant. Manage (pin/edit/archive) on the Memory page. |
| 🔗 | **Cross-chat references** | Past conversations are embedded in ChromaDB and recalled into new chats, with the source conversation cited. |
| 📈 | **Self-improving personalization** | A rolling user profile (expertise, style, preferences) is rebuilt from your chats and 👍/👎 feedback. |
| 🦙 | **Auto-discovered models** | Local + `:cloud` Ollama models and every connected provider's catalog, fetched live, grouped by provider with a filter, each with an auto-generated use hint. |
| 🔑 | **BYOK cloud providers** | OpenAI, Anthropic, OpenRouter (incl. OAuth sign-in), xAI, Google Gemini. Keys live **in memory only** — never on disk. |
| ☁️ | **Ollama Cloud / remote** | No local install needed: point the endpoint at `ollama.com` (or any remote Ollama) with an API key. |
| 🎭 | **Assistants (presets)** | Saved bundles of system prompt + model + temperature. A 🧑‍💻 **Coding Agent** is built in (auto-picks your best coding model). |
| ⚖️ | **Model compare** | Same prompt, two models, side-by-side parallel streams with per-model latency and tokens/sec. |
| 🌐 | **Web search** | Opt-in DuckDuckGo search with sources cited inline — no API key required. |
| 📎 | **Files & images** | PDF, Word (docx/doc), Excel, CSV, code, images. Vision models see images directly; text-only models get a local OCR fallback. Large files are chunked + retrieved (RAG). |
| ⚡ | **Non-blocking generation** | Replies stream in a background worker with an animated typing indicator, a ⏹ Stop button, and instant message echo. Navigate anywhere — nothing is lost. |
| 💬 | **Message actions** | Copy, regenerate, edit-and-resend, 👍/👎 feedback, and a per-reply footer with model · time · tokens/sec. |
| 🗂 | **Organize & find** | Pin chats, rename, date-grouped sidebar, full-text **and** semantic search across all conversations. |
| 📤 | **Data controls** | Per-chat Markdown export, full JSONL export/import, "Clear all chats", and a 🧨 panic wipe (chats + memories + profile + keys). |
| 🩺 | **Health bar** | Live endpoint latency + which models are loaded in VRAM, refreshed every 15 s. |

## Screenshots

| Chat (dark theme, Coding Agent) | Model compare |
|---|---|
| <img src="docs/screenshot-chat.png" width="100%"> | <img src="docs/screenshot-compare.png" width="100%"> |

## Learning guide

New to the app itself? Read the [User Guide](USER_GUIDE.md) for a plain-language,
feature-by-feature walkthrough (setup, usage, and the "why" behind each feature) aimed
at technical and non-technical readers alike.

Want to understand the code? Start with the
[Zero-to-Hero Study Handbook](ZERO_TO_HERO_STUDY_HANDBOOK.md) for a repository-grounded
path from AI foundations to contributing. The companion
[interactive tutorial](docs/tutorial/index.html) provides a browser-friendly walkthrough.
The former Streamlit-only handbook PDF is retained only as a
[legacy archive](docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf).

## Setup

### Prerequisites

| Requirement | Why | Check |
|---|---|---|
| [Ollama](https://ollama.com/download) | Serves local models | `ollama --version` |
| At least one chat model | Something to talk to | `ollama list` |
| An embedding model | Memory, references, RAG | `ollama pull embeddinggemma` |
| Python 3.12 + [uv](https://docs.astral.sh/uv/) | Runs the app | `uv --version` |
| *(optional)* LibreOffice or `antiword` | Legacy `.doc` parsing | `which soffice` |

> **No local Ollama?** You can run fully on Ollama Cloud instead — see
> [Usage → Ollama Cloud](#usage).

### Install & run

```bash
# 1. Clone
git clone https://github.com/pypi-ahmad/local-ai-chat-studio.git
cd local-ai-chat-studio

# 2. Pull an embedding model once (enables memory + RAG)
ollama pull embeddinggemma

# 3. Install dependencies
uv sync
```

### Start the app

The v2 application uses one local FastAPI server. Build the frontend once, then start
the studio:

```bash
cd frontend
npm ci
npm run build
cd ..
uv run chat-studio
```

Open **http://127.0.0.1:8000**. For frontend development, run `npm run dev` from
`frontend/` in a second terminal; Vite proxies `/api` to FastAPI.

The previous Streamlit interface remains available during the parity window:

```bash
uv run streamlit run app.py
```

Streamlit prints the URL — usually **http://localhost:8501**. Use `--server.port 8503`
(or any port) to fix it:

```bash
uv run streamlit run app.py --server.port 8503
```

### Stop the app

Press **`Ctrl+C`** in the terminal where it's running.

If it was started in the background and you've lost the terminal:

```bash
pkill -f "streamlit run app.py"
```

## Usage

- **Chat** — pick an assistant and a model in the sidebar (filter by provider), type,
  attach files/images with 📎, or start from a prompt chip. Toggle 🌐 web search for
  cited, up-to-date answers.
- **Assistants** — select the built-in 🧑‍💻 Coding Agent, or create your own on
  **Settings → Assistants** from your current system prompt + model + temperature.
- **Compare** — open **Compare**, pick two models, ask once, watch both stream with
  timing stats. Nothing is saved to history.
- **Cloud providers** — on **Providers**, paste an API key (or set the env var) for
  OpenAI / Anthropic / OpenRouter / xAI / Gemini. OpenRouter also supports
  sign-in-with-account.
- **Ollama Cloud** — on **Providers → Ollama endpoint**, click *Use Ollama Cloud* and
  paste a key from [ollama.com/settings/keys](https://ollama.com/settings/keys); chat,
  embeddings, and vision then run on ollama.com with no local install.
- **Memory** — review what it has learned about you on **Memory** (pin, edit,
  archive, delete; rebuild your profile on demand).

## Configuration

Defaults live in [`src/config.py`](src/config.py); override any of them with
`CHAT_`-prefixed environment variables or a `.env` file.

| Variable | Default | Purpose |
|---|---|---|
| `CHAT_OLLAMA_HOST` | `http://localhost:11434` | Ollama endpoint |
| `CHAT_TEMPERATURE` | `0.7` | Default sampling temperature |
| `CHAT_REQUEST_TIMEOUT` | `300` | Seconds before a hung request errors |
| `CHAT_MEMORY_DECAY_DAYS` | `90` | Archive unused memories after this |
| `CHAT_PROFILE_REFRESH_EVERY` | `5` | Rebuild the user profile every N chats |
| `OPENAI_API_KEY` etc. | — | Read-only key fallback per provider |
| `OLLAMA_API_KEY` | — | Key for Ollama Cloud / secured servers |

All data (SQLite DB, Chroma vectors, uploads) lives in `data/` — delete it to reset.

## Privacy and Security

- **API keys never touch disk.** Keys entered in the UI live only in the server
  process memory for the session — never written to a file, logged, or exported, and
  sent only to the provider they belong to. Restart = forgotten. Env vars are a
  read-only fallback.
- **One-click hygiene** — per-key *Forget*, global *Forget all keys*, and a 🧨 panic
  wipe that erases chats, memories, profile, vectors, and keys.
- **Everything else stays local** — SQLite + ChromaDB in `data/`, no telemetry.
- **No auth built in** — only expose beyond `localhost` on a network you trust.

## Architecture

```
local-ai-chat-studio/
├── app.py                  # Chat page (UI only — all slow work is off-thread)
├── pages/
│   ├── 1_Memory.py         # Memory & profile manager
│   ├── 2_Settings.py       # Generation, features, assistants, data controls
│   ├── 3_Providers.py      # BYOK keys + Ollama endpoint
│   └── 4_Compare.py        # Side-by-side model compare
├── src/
│   ├── catalog.py          # Unified model catalog (Ollama + providers)
│   ├── ollama_client.py    # Discovery, streaming, stats, health
│   ├── providers.py        # OpenAI/Anthropic/OpenRouter/xAI/Gemini + key vault
│   ├── jobs.py             # Background generation workers (stream, search, RAG)
│   ├── orchestrator.py     # Per-turn prompt assembly (memory + refs + docs)
│   ├── memory.py           # Fact extraction, dedup, decay
│   ├── personalization.py  # Rolling user profile
│   ├── rag.py              # ChromaDB indexing + retrieval
│   ├── files.py            # Upload parsing (PDF/Office/images/…)
│   ├── chat_store.py       # SQLite persistence (chats, presets, feedback)
│   └── config.py           # Pydantic settings
└── data/                   # SQLite + vectors (git-ignored)
```

**Design notes**

- *Replies are background jobs.* The submit handler persists your message and returns
  in milliseconds; a worker thread does file parsing, OCR, web search, retrieval, and
  streaming — so generation survives page navigation and the UI never blocks.
- *Zero hardcoded models.* Hints, vision detection, and the coding-agent model pick
  are all derived from live API metadata and name patterns.
- *Helper tasks stay local.* Titles, memory extraction, embeddings, and OCR always use
  local models — even when you chat with a cloud provider.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot reach Ollama" banner | `ollama serve` (or set the endpoint on **Providers**) |
| Memory & RAG off | `ollama pull embeddinggemma`, then ⟳ |
| New model missing from dropdown | Click ⟳ (lists are cached 1–5 min) |
| `:cloud` model returns 403 | That model needs an Ollama subscription |
| First reply slow / stuck | VRAM model swap — watch the health bar; ⏹ Stop and pick a smaller model, or `sudo systemctl restart ollama` if wedged |
| Provider key gone after restart | By design (session-only). Use env vars to persist |
| `.doc` extracts nothing | Install LibreOffice or `antiword` |

## Roadmap

- [ ] Voice in/out (local faster-whisper + Piper)
- [ ] Folders & tags for conversations
- [ ] Optional passcode for LAN exposure
- [ ] Test suite + CI
- [ ] Docker one-liner

## Contributing

Contributions are very welcome — this is an open-source project and PRs, issues, and
ideas are always appreciated. 🙌 Read the full guide in
[CONTRIBUTING.md](CONTRIBUTING.md); issues and PRs come with templates, and the
project follows a [Code of Conduct](CODE_OF_CONDUCT.md). Security reports go through
[SECURITY.md](SECURITY.md).

1. Fork and create a feature branch: `git checkout -b feat/your-idea`
2. Keep changes focused; match the existing style (type hints, Google-style
   docstrings, `loguru`).
3. Run the app and verify your change end-to-end.
4. Open a PR describing the *why*.

Good first issues: new file parsers, more BYOK providers, model-hint heuristics,
tests, UI polish. Found a bug?
[Open an issue](https://github.com/pypi-ahmad/local-ai-chat-studio/issues).

## License

Released under the [MIT License](LICENSE) — free to use, modify, and share.
