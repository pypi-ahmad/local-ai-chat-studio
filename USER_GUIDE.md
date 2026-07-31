# Local AI Chat Studio — User Guide

A plain-language guide to **what this app does, why you'd use it, and how to run every
feature** — written for technical and non-technical readers alike. If you want to read
the source code itself, see the [Zero-to-Hero Study Handbook](ZERO_TO_HERO_STUDY_HANDBOOK.md)
instead; this guide is about *using* the product.

> **Which interface do I actually use?** The repository currently ships two UIs. The
> **Streamlit app** (`app.py` + `pages/`) is the complete, feature-rich product — every
> feature described below runs there today. A newer **FastAPI + React** app
> (`backend/` + `frontend/`) is under active construction: its API works, but the
> browser UI is still a visual shell that isn't wired to real conversations yet. Use
> Streamlit to actually chat, compare models, manage memory, etc. This guide walks
> through the Streamlit app.

---

## 1. Why this app exists (the business case)

Most AI chat tools force a trade-off: a polished cloud product that reads (and monetizes)
your data, or a bare-bones local tool that forgets everything between messages and needs
constant re-configuration. Local AI Chat Studio is built to remove that trade-off:

| Promise | What it means for you |
|---|---|
| **Local-first** | Runs against your own [Ollama](https://ollama.com/) install by default. Nothing leaves your machine unless you explicitly turn on a cloud provider. No subscription required to get a usable chat assistant. |
| **Zero-maintenance** | New model lists are fetched live every time — pull a new model in Ollama, hit refresh, it's in the dropdown. No code or config edits when a provider ships a new model. |
| **It knows you** | The assistant builds long-term memory and a personalization profile from your conversations, so answers get more relevant to you over time — without you managing a prompt library by hand. |

**Who it's for:**
- **Individuals / privacy-conscious users** who want a ChatGPT-style assistant that keeps
  their conversations and files on their own disk.
- **Developers** who want a coding assistant that can also compare model quality/speed
  side by side before picking one to rely on.
- **Teams evaluating LLM providers** who want one UI to test Ollama, OpenAI, Anthropic,
  Gemini, OpenRouter, and xAI without juggling five separate tools or committing to a
  single vendor.
- **Anyone who wants zero recurring cost**: the app itself is free and open source; you
  only pay for the cloud provider keys you choose to add, and nothing if you stick to
  local Ollama models.

---

## 2. Clone, set up, and run it

### 2.1 What you need first

| Requirement | Why you need it | Check it's installed |
|---|---|---|
| [Ollama](https://ollama.com/download) | Serves local models — the app's default brain | `ollama --version` |
| At least one chat model | Something to actually talk to | `ollama list` (if empty: `ollama pull llama3.2` or any model) |
| An embedding model | Powers memory, cross-chat recall, and file search (RAG) | `ollama pull embeddinggemma` |
| Python 3.12+ and [uv](https://docs.astral.sh/uv/) | Runs the Python backend | `uv --version` |
| *(optional)* LibreOffice or `antiword` | Lets it read old `.doc` files | `which soffice` |

No local machine capable of running models? You can skip Ollama entirely and point the
app at **Ollama Cloud** instead (covered in [§3.4](#34-connect-a-cloud-provider-byok)) —
you still need Python/uv to run the app itself.

### 2.2 Clone and install

```bash
git clone https://github.com/pypi-ahmad/local-ai-chat-studio.git
cd local-ai-chat-studio

# Pull an embedding model once — enables memory, cross-chat recall, and RAG
ollama pull embeddinggemma

# Install all Python dependencies into a project-local environment
uv sync
```

### 2.3 Start it

```bash
uv run streamlit run app.py
```

Streamlit prints a local URL in the terminal — usually **http://localhost:8501**. Open
that in your browser. If the port is already busy, pin one explicitly:

```bash
uv run streamlit run app.py --server.port 8503
```

### 2.4 Stop it

Press **`Ctrl+C`** in the terminal it's running in. If you started it in the background
and lost the terminal:

```bash
pkill -f "streamlit run app.py"
```

### 2.5 Everything it stores, and how to reset

All data — conversations, memories, vector search index, uploaded files — lives in a
single `data/` folder next to the code (SQLite database + a ChromaDB vector store).
**Delete that folder to reset the app to a blank slate.** Nothing is sent anywhere
outside your machine unless you connect a cloud provider (§3.4) or turn on web search.

---

## 3. Feature walkthrough

Every row below is a feature you'll find in the running app, in the order you'd
naturally discover them. Each has a **why it matters** (business/user angle) and a
**how it works** (technical angle, kept simple).

### 3.1 Chat

**What you do:** pick a model from the sidebar dropdown, type a message, hit enter (or
attach a file first with 📎). Four prompt chips ("Summarize a document", "Explain some
code", "Brainstorm ideas", "Teach me something") give you a one-click starting point on
a blank conversation.

- **Why it matters:** this is the core loop — everything else in this guide augments it.
- **How it works:** your message is saved immediately, then a background worker thread
  streams the model's reply token-by-token into the chat window (see §3.9). You can
  navigate to another page or start a new chat while a reply is still generating — it
  keeps going and finishes in place.

### 3.2 Assistants (presets)

**What you do:** pick an assistant from the **Assistant** dropdown at the top of the
sidebar. A built-in **🧑‍💻 Coding Agent** ships out of the box (it auto-picks whichever
of your models looks best suited to coding). Create your own on **Settings →
Assistants**: it saves your *current* system prompt + model + temperature as a
reusable, named bundle.

- **Why it matters:** lets you switch personas instantly ("code reviewer" vs. "ELI5
  tutor") without retyping a system prompt every time.
- **How it works:** a preset is just three stored values (prompt text, model key,
  temperature) that get re-applied to the chat page's controls when you pick it.

### 3.3 Auto-discovered models

**What you do:** open the model dropdown in the sidebar — every model Ollama currently
has pulled (plus any connected cloud provider's catalog) is already there, grouped by
provider, each with a short auto-generated hint (e.g. "good for code", "vision-capable").
Hit **⟳** to refresh the list after pulling a new model.

- **Why it matters:** you never edit a config file to add a model. Pull it in Ollama,
  refresh, use it.
- **How it works:** the app calls Ollama's `/api/tags` and each connected provider's
  model-listing endpoint live, merges the results, and derives the hint text from model
  name patterns and reported capabilities — nothing is hardcoded.

### 3.4 Connect a cloud provider (BYOK)

**What you do:** open **Providers**. For OpenAI, Anthropic, xAI, or Gemini: click the
link to that provider's console, create a key, paste it in, click **Use key**. For
OpenRouter, you can instead click **Sign in with OpenRouter** (an OAuth flow — no
copy-pasting a key). Click **Test connection** to verify it works.

- **Why it matters:** lets you compare a frontier cloud model against your local models
  without leaving the app, while keeping the "local-first" promise intact — cloud is
  opt-in per key, per browser session.
- **How it works:** the key is held **only in the running server process's memory** for
  your session. It is never written to disk, never logged, never included in exports.
  Restarting the app forgets every key. (If you'd rather not paste keys each restart,
  set the matching environment variable instead — see §4 — that acts as a read-only
  fallback.)

### 3.5 Ollama Cloud / remote Ollama

**What you do:** on **Providers → Ollama endpoint**, click **☁️ Use Ollama Cloud**, then
paste an API key from [ollama.com/settings/keys](https://ollama.com/settings/keys). Or,
to point at any remote Ollama server you run yourself, type its URL into the **Ollama
host** field instead.

- **Why it matters:** you can use this app with zero local GPU/CPU model-serving at
  all — chat, embeddings, and vision all run on `ollama.com`'s infrastructure under your
  account.
- **How it works:** the app just swaps the base URL + auth header it sends Ollama-style
  requests to; everything else (discovery, streaming, memory) works identically.

### 3.6 Model compare

**What you do:** open **Compare**, pick **Model A** and **Model B**, type one prompt,
watch both stream side by side with live timing stats (latency, tokens/sec).

- **Why it matters:** the fastest way to answer "which model should I actually use for
  this kind of task?" with your own prompts, not a benchmark leaderboard.
- **How it works:** two independent background jobs run in parallel against the two
  selected models with the same prompt; nothing here touches your saved chat history —
  it's a disposable scratchpad.

### 3.7 Long-term memory

**What you do:** just chat normally. Durable facts the assistant learns about you
("prefers Python over JS", "works on a Windows machine") show up on the **Memory**
page, where you can pin (always inject), edit, archive, or delete each one.

- **Why it matters:** this is what makes the assistant feel like it "knows you" across
  conversations instead of starting from zero every time.
- **How it works:** periodically (every few messages), a small local helper model reads
  the recent conversation and extracts candidate facts as a JSON list. Each candidate is
  compared by embedding similarity against existing memories to avoid near-duplicates,
  then stored. Relevant memories are looked up by similarity and injected into future
  prompts. Unused, unpinned memories quietly archive themselves after 90 days (§4).

### 3.8 Cross-chat references & personalization profile

**What you do:** nothing extra — it happens automatically. You'll occasionally see "🔗
referencing: *older chat title*" above a reply, meaning it pulled context from a past
conversation. Your rolling profile (writing style, expertise level, preferences) is
visible at the top of the **Memory** page and can be rebuilt on demand.

- **Why it matters:** you can ask "what did we decide about X last week?" in a brand-new
  chat and get a grounded answer, and the assistant's tone/detail level adapts to you
  over time without you configuring it.
- **How it works:** every finished exchange is embedded and stored in a vector database
  (ChromaDB); new questions are embedded too and matched against past exchanges by
  cosine similarity, excluding the current conversation. The profile is a short prose
  summary periodically regenerated from your recent messages plus any 👍/👎 feedback
  you've left.

### 3.9 Non-blocking generation

**What you'll notice:** an animated "assistant is thinking" indicator, a live-streaming
reply, a **⏹ Stop** button while it's generating, and — critically — the reply keeps
generating even if you switch to a different chat or a different page.

- **Why it matters:** you're never stuck staring at a spinner. Fire off a long request
  and go do something else in the app.
- **How it works:** the submit action returns instantly after saving your message; the
  actual model call runs on a background worker thread that the UI polls for updates,
  independent of whichever page you're currently looking at.

### 3.10 Message actions

**What you do:** hover any assistant reply for 📋 **Copy**, 🔄 **Regenerate** (only on
the latest reply), and a 👍/👎 feedback control. Hover your own latest message for
✏️ **Edit & resend**.

- **Why it matters:** standard "didn't like that answer, try again" and "let me fix my
  question" workflows you'd expect from any modern chat tool.
- **How it works:** regenerate deletes the last assistant message and re-runs generation
  from the prior user turn; feedback (👍/👎) is stored and later feeds the
  personalization profile rebuild.

### 3.11 Web search

**What you do:** toggle **🌐 Web search** in the sidebar before asking a question that
needs current information.

- **Why it matters:** gets you cited, up-to-date answers for anything after the model's
  training cutoff — no API key required.
- **How it works:** the query is sent to DuckDuckGo, top results are fetched and added
  to the model's context, and the reply cites them inline as `[1]`, `[2]`, etc.

### 3.12 Files & images

**What you do:** attach a file with 📎 in the chat box — PDF, Word (`.docx`/`.doc`),
Excel, CSV, code, or an image.

- **Why it matters:** "summarize this contract" or "what's wrong with this
  screenshot" just works, without you manually pasting extracted text.
- **How it works:** text is extracted per file type (legacy `.doc` needs LibreOffice or
  `antiword` installed). Small documents are pasted straight into the prompt; large ones
  are chunked into overlapping windows, embedded, and retrieved only for the relevant
  parts (this is RAG — retrieval-augmented generation). Vision-capable models see images
  directly; text-only models get a local OCR/description fallback first.

### 3.13 Organize & find

**What you do:** pin important chats (📌 in the ⋯ menu), rename them, and use the
sidebar search box — it matches both exact text and *meaning* (semantic search), so
"that pricing discussion" can find a chat that never used the word "pricing."

- **Why it matters:** conversation history becomes useful again once you have hundreds
  of chats instead of ten.
- **How it works:** full-text search hits SQLite directly; semantic search embeds your
  search query and matches it against the same vector store used for cross-chat
  references.

### 3.14 Data controls

**What you do:** on **Settings**, export one chat as Markdown (from the sidebar's ⋯
menu) or every chat as JSONL, import a previous JSONL export, clear all chats, or hit
the **🧨 panic wipe** for a hard reset.

- **Why it matters:** your data is portable (back it up, move it, or fine-tune a model
  on it later) and disposable on demand — no "contact support to delete my data" dance.
- **How it works:** panic wipe deletes every conversation, memory, profile entry,
  preset, vector, and in-memory API key in one action — there is no undo, and the UI
  requires an explicit confirmation click before it runs.

### 3.15 Health bar

**What you'll notice:** a small line at the bottom of the sidebar — a colored dot,
Ollama's response latency in milliseconds, and which models are currently loaded in
VRAM. It refreshes every 15 seconds.

- **Why it matters:** instantly tells you *why* a reply is slow to start (model is still
  loading into memory) instead of leaving you guessing.
- **How it works:** it pings Ollama's health/`ps`-equivalent endpoints on a timer.

---

## 4. Configuration reference

All settings live in [`src/config.py`](src/config.py) with sensible defaults. Override
any of them with a `CHAT_`-prefixed environment variable or a `.env` file in the project
root — no code changes needed.

| Variable | Default | What it controls |
|---|---|---|
| `CHAT_OLLAMA_HOST` | `http://localhost:11434` | Where the app looks for Ollama |
| `CHAT_TEMPERATURE` | `0.7` | Default sampling temperature for new chats |
| `CHAT_REQUEST_TIMEOUT` | `300` | Seconds before a hung model request is treated as failed |
| `CHAT_MEMORY_DECAY_DAYS` | `90` | Archive a memory after this many days unused |
| `CHAT_PROFILE_REFRESH_EVERY` | `5` | Rebuild your personalization profile every N conversations |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY` | — | Read-only fallback key per provider, if you'd rather not paste keys in the UI each restart |
| `OLLAMA_API_KEY` | — | Key for Ollama Cloud or a secured remote Ollama server |

---

## 5. Privacy and security, in plain terms

- **Keys never touch disk.** Anything you paste into **Providers** lives only in the
  running server's memory for your browser session. Restart the app and it's gone.
- **Local stays local, by default.** Chats, memories, and files are stored on your own
  machine in `data/` (SQLite + ChromaDB) — no telemetry, no external calls unless you
  explicitly enable web search or select a cloud model.
- **If you do use a cloud model,** your message (and whatever context — memory, RAG
  chunks, etc. — got attached to it) is sent to that provider, same as pasting it into
  their own chat UI. Local storage doesn't change that.
- **One-click hygiene:** forget a single provider key, forget all keys, or panic-wipe
  everything (§3.14).
- **No built-in login.** This app has no user accounts. Only expose it beyond
  `localhost` on a network you fully trust.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot reach Ollama" banner | Run `ollama serve`, or set the endpoint on **Providers** |
| Memory / cross-chat / file search feels "off" | `ollama pull embeddinggemma`, then hit ⟳ |
| A model you just pulled isn't in the dropdown | Click ⟳ — lists are cached for 1–5 minutes |
| A `:cloud` model returns a 403 | That model needs an active Ollama subscription |
| First reply is very slow / stuck | The model is swapping into VRAM — watch the health bar; **⏹ Stop** and try a smaller model, or restart the Ollama service |
| A provider key vanished after restart | Expected — keys are session-only by design. Use an environment variable if you want it to persist |
| `.doc` file extracts no text | Install LibreOffice or `antiword`; `.docx` works without either |

---

## See also

- [README.md](README.md) — project overview, screenshots, roadmap
- [ZERO_TO_HERO_STUDY_HANDBOOK.md](ZERO_TO_HERO_STUDY_HANDBOOK.md) — how the code itself
  works, from AI fundamentals to making a contribution
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to submit a change
