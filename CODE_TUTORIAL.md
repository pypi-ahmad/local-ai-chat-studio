# Local AI Chat Studio — Code Tutorial: Zero to Hero

> Historical architecture note: sections describing `app.py`, `pages/`, or Streamlit
> document the retired UI. The current application flow is
> `backend/app/main.py` → `runs.py`/`workspace.py`/`store.py` →
> `frontend/src/api/client.ts` → `frontend/src/App.tsx`.

> Current UI note (v0.7.8): `App.tsx` and its focused components provide safe rich
> Markdown/code/LaTeX rendering, provider-scoped capability-aware model search,
> attachment status/retry cards, saved-message navigation, exact context overflow
> warnings with blocking over-budget sends, optional local history compression,
> grouped responsive navigation, a persisted Context/Evidence inspector, and a
> sandboxed split-pane preview for fenced HTML, SVG, Mermaid, and code artifacts.

This is a **read-the-code-out-loud** tutorial. It walks every module in this
repository, in the order data actually flows through it, quoting real
functions and explaining why each one is shaped the way it is. If you want
dense reference tables instead (routes, config keys, glossary), read
[ZERO_TO_HERO_STUDY_HANDBOOK.md](ZERO_TO_HERO_STUDY_HANDBOOK.md) — this
document complements it with a slower, narrative walkthrough for a reader who
has never seen the codebase before.

No prior AI/backend experience assumed. Every theory term is defined the
first time it's used.

---

## Part 1 — Foundations: the ideas this codebase is built on

You don't need a machine learning degree to read this codebase, but you do
need these ten ideas, because every module leans on at least one of them.

**LLM (large language model).** A program that reads a sequence of text and
predicts what text comes next, one small unit at a time. This app never trains
a model — it only *calls* one (via [Ollama](https://ollama.com/) locally, or
a cloud API) and streams its predictions back to a chat window.

**Token.** The unit a model actually reads/writes — often a word-piece, not a
whole word. `"unhappiness"` might be three tokens. Cost, speed, and the
context window are all measured in tokens, not characters.

**Context window.** The maximum number of tokens a single request can contain
(prompt + conversation history + retrieved documents + the answer, combined).
Every piece of "context assembly" code in this repo (`orchestrator.py`,
`AppConfig.doc_context_budget_chars`) exists because that budget is finite —
you can't just paste an entire PDF into every request.

**Temperature.** A sampling knob, roughly 0–2. Low = more deterministic/
repetitive output; high = more varied/surprising. It is not a "smartness"
dial. You'll see `temperature: float = 0.7` as the default nearly everywhere.

**Embedding.** A function that turns text into a fixed-length list of numbers
(a vector) such that texts with *similar meaning* produce *nearby* vectors —
even if they don't share any words. This app calls Ollama's embedding
endpoint (`src/ollama_client.py::embed_texts`) to do this.

**Cosine similarity.** The standard way to compare two embedding vectors —
it measures the angle between them, ignoring length. Range is theoretically
`-1..1`; closer to `1` means "more similar." ChromaDB (the vector database
this app uses) returns a *distance* instead, so the code converts it:
`similarity = 1 - distance` (see `src/rag.py::_flatten`, line 174).

**Vector database.** A database specialized for "find me the N stored texts
whose embeddings are closest to this query's embedding." This app uses
[ChromaDB](https://www.trychroma.com/), persisted to `data/chroma`, holding
three separate collections: uploaded-document chunks, past chat turns, and
long-term memories.

**RAG (retrieval-augmented generation).** The pattern of: embed a question →
find the most relevant stored chunks by vector search → paste those chunks
into the model's prompt as extra context → let the model answer using them.
It does **not** train or fine-tune the model; it just gives it better
material to read for *this one request*. You'll see this exact pattern three
times in this repo (documents, cross-chat memory, long-term facts) — same
technique, three different collections.

**REST vs. SSE.** REST (`POST /api/v1/conversations`) is "one request, one
response." SSE (Server-Sent Events, `text/event-stream`) is "one request,
many responses over time" — the mechanism this app's v2 backend uses to
stream a generating reply to the browser token-by-token without WebSockets.

**Threads vs. `asyncio` tasks — two different concurrency models in this
repo.** The legacy Streamlit app uses **OS threads** (`threading.Thread`,
daemon=True) because Streamlit's scripting model reruns the whole page
top-to-bottom on every interaction — a thread is the only way to keep work
alive *across* reruns. The v2 FastAPI backend uses **`asyncio` tasks**
(`asyncio.create_task`) because FastAPI's request handlers already run on an
event loop — no separate OS thread needed, just cooperative scheduling. Same
underlying goal (don't block the user while a model streams), two different
tools because the two web frameworks work fundamentally differently.

---

## Part 2 — The 10,000-foot view

The operating product is a **single FastAPI + React application**:

```
local-ai-chat-studio/
├── backend/app/     FastAPI API, runs, workspace, store, managed shutdown
├── frontend/src/    React workspace (Chat, Compare, Providers, Library, Settings)
├── src/             Shared file parsing, Ollama, and Chroma helpers
└── tests/           Backend and frontend contract tests
```

The server listens on `127.0.0.1:8506`. Settings **Stop Studio** posts to
`/api/v1/runtime/shutdown`. The Streamlit `app.py` / `pages/` UI has been
removed; leftover modules under `src/` are helpers, not a second app.

This tutorial still walks some historical Streamlit code in Part 3 because
that path explains product behavior that later moved into FastAPI. Treat
those sections as history. The current request path is
`backend/app/main.py` → `runs.py` / `workspace.py` / `store.py` →
`frontend/src/api/client.ts` → `frontend/src/App.tsx`.

---

## Part 3 — Historical Streamlit path (retired UI)

> This part documents the removed Streamlit application. Do not run
> `streamlit run app.py`; that entrypoint is gone. Read it only to understand
> how the older stack assembled context.

We'll follow one concrete scenario end to end: **a user types "hello" and
hits Enter.** Each subsection below is the next stop on that historical
journey.

### 3.1 `src/config.py` — one object everything else reads from

```python
class AppConfig(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    data_dir: Path = PROJECT_ROOT / "data"
    temperature: float = 0.7
    request_timeout: float = 300.0
    memory_enabled: bool = True
    chunk_chars: int = 3200
    rag_top_k: int = 5
    memory_decay_days: int = 90
    ...

config = AppConfig()
config.ensure_dirs()
```

This is a [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
object, built **once** at import time and imported everywhere as `from
src.config import config`. Every numeric knob you'll meet later (chunk size,
similarity threshold, decay window) traces back to one of these fields, and
every one is overridable with a `CHAT_`-prefixed environment variable with no
code change (`env_prefix="CHAT_"`). This is the config-as-single-object
pattern: one import, one source of truth, trivially overridable at deploy
time.

### 3.2 `src/chat_store.py` — SQLite, the durable memory

Everything the user can see persisted (conversations, messages, long-term
memories, feedback, presets) lives in one SQLite file (`data/app.db`). Two
patterns repeat through the whole file:

```python
def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(config.db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
```

A **fresh connection per call**, not a long-lived global one — simple, and
correct for SQLite's threading rules (this file is written to *and* read
from a background thread — see 3.10). `PRAGMA journal_mode=WAL` lets reads
and writes happen concurrently without locking the whole database.

```python
def add_message(conv_id, role, content, attachments=None) -> str:
    msg_id = uuid.uuid4().hex
    now = _now()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO messages (id, conv_id, role, content, attachments_json, ts) "
            "VALUES (?,?,?,?,?,?)",
            (msg_id, conv_id, role, content, json.dumps(attachments) if attachments else None, now),
        )
        conn.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, conv_id))
    return msg_id
```

Every query in this file uses `?` placeholders — parameters are passed
separately from the SQL string, never string-formatted in. This is the single
most important habit for avoiding SQL injection, and it's applied
consistently across all ~30 functions in this file.

### 3.3 `src/ollama_client.py` — talking to the model server

```python
def _client() -> ollama.Client:
    from src import providers
    host = providers.get_ollama_host()
    key = providers.get_ollama_key()
    ...
    client = ollama.Client(host=host, headers=headers, timeout=config.request_timeout)
```

The Ollama client is rebuilt (and cached) from whatever host/key
`providers.py` currently holds — so switching to a remote server or Ollama
Cloud on the Providers page takes effect immediately, no restart. This
"resolve config at call time, not at import time" pattern is what makes the
zero-restart provider switching work.

```python
def stream_chat(model, messages, temperature=None, stats=None) -> Iterator[str]:
    stream = _client().chat(model=model, messages=messages, stream=True, ...)
    for chunk in stream:
        content = chunk.get("message", {}).get("content", "")
        if content:
            yield content
```

`yield` makes this a **generator** — it doesn't fetch the whole reply and
then hand it over; it hands over each token *as Ollama produces it*. This is
the streaming mechanism, in its simplest form, that every later layer just
forwards.

Also worth noticing: `ModelInfo` (a small `@dataclass`) and its
`is_vision`/`is_embedding`/`is_thinking` properties are computed from
Ollama's own `/api/tags` metadata, not a hardcoded model list. That's the
"zero-maintenance" promise from the README made concrete: pull a new model,
and its capabilities are already known.

### 3.4 `src/catalog.py` + `src/model_labels.py` — one dropdown, many sources

The chat page needs to show *one* unified model list, but models come from
two different places (local Ollama, cloud providers). `catalog.py` merges
them into one shape:

```python
@dataclass
class SelectedModel:
    key: str            # 'ollama::<name>' or '<provider>::<id>'
    provider: str
    name: str
    hint: str
    ...
```

`key` is the thing that gets stored in the database as "which model was this
conversation using" — notice it's a plain string like `ollama::llama3.2` or
`openai::gpt-4o`, not a foreign key into a models table. That's deliberate:
the model catalog is entirely dynamic (rebuilt from live API calls every
page load), so there is no stable "models" table to reference — the key is
self-describing instead.

`model_labels.py::hint_for` is a small rule-based classifier — regex against
the model's *name* (`coder`, `ocr`, `embed`, ...) plus its reported
capabilities — that produces the "coding, fast" style hint text you see in
the dropdown. No ML here, just pattern matching over metadata that's already
available.

### 3.5 `src/providers.py` — cloud providers and the secrets vault

```python
_secrets: dict[str, str] = {}
_secrets_lock = threading.Lock()

def get_api_key(provider: str) -> str | None:
    return _get_secret(provider) or os.environ.get(PROVIDERS[provider]["env"]) or None
```

This is the entire "key management system": a plain Python dict, guarded by
a lock (because a background thread reads it — see 3.10), with an
environment-variable fallback. There is **no database table for API keys** —
that's not an oversight, it's the whole privacy promise: keys never touch
disk, so there's nothing to leak from disk. Restart the app, the dict is
empty again.

The OAuth flow at the bottom (`openrouter_auth_url` / `openrouter_exchange_code`)
implements [PKCE](https://www.rfc-editor.org/rfc/rfc7636) — a verifier
(`secrets.token_urlsafe(48)`) is generated and kept in memory; its SHA-256
hash (the "challenge") is sent to OpenRouter; when the user finishes login,
OpenRouter's returned code can only be exchanged successfully if the original
verifier is presented too. This proves the exchange request came from the
same process that started the flow, without ever putting a secret in a URL.
Compare this to §4.6's v2 equivalent — same idea, different bug.

### 3.6 `src/files.py` — turning an upload into text

```python
def parse_upload(filename: str, raw: bytes) -> Attachment:
    ext = _ext(filename)
    if ext in IMAGE_TYPES:
        return Attachment(name=filename, kind="image", image_bytes=raw, ...)
    if ext == "pdf":
        return Attachment(name=filename, kind="document", text=_parse_pdf(raw))
    ...
```

One dispatcher function, one private parser per format
(`_parse_pdf`/`_parse_docx`/`_parse_excel`/`_parse_legacy_doc`). Each parser
imports its library **inside the function**, not at module load — so the app
doesn't require `pypdf`+`python-docx`+`pandas`+`openpyxl` all to be importable
just to start; only the format you actually upload needs its library present.

`chunk_text` is worth reading closely — it's the "split a big document into
overlapping windows" logic that makes RAG possible:

```python
for sep in ("\n\n", "\n", ". "):
    cut = window.rfind(sep)
    if cut > chunk_chars // 2:
        end = start + cut + len(sep)
        break
```

It doesn't just cut every N characters — it looks backward from the target
cut point for a paragraph break, then a line break, then a sentence end,
preferring to cut on a real boundary so chunks don't split mid-sentence.

### 3.7 `src/rag.py` — the vector search layer

```python
_chroma = chromadb.PersistentClient(path=str(config.chroma_dir))

def _collection(name: str) -> chromadb.Collection:
    return _chroma.get_or_create_collection(name, metadata={"hnsw:space": "cosine"})
```

One Chroma client, three collections (`doc_chunks`, `chat_history`,
`memories`) distinguished by name. `hnsw:space: "cosine"` tells Chroma to
rank results by cosine similarity (§1) rather than raw Euclidean distance.

```python
def search_history(embed_model, exclude_conv, query, top_k, min_similarity):
    res = col.query(
        query_embeddings=_embed(embed_model, [query]),
        n_results=top_k * 3,   # over-fetch, then filter out the current conversation
        where={"conv_id": {"$ne": exclude_conv}},
    )
    hits = [h for h in _flatten(res) if h["similarity"] >= min_similarity]
    return hits[:top_k]
```

This is the "cross-chat references" feature from the README. Two things to
notice: it asks Chroma to exclude the *current* conversation server-side
(`where={"conv_id": {"$ne": exclude_conv}}`) so a chat can't "recall" itself,
and it applies a `min_similarity` floor — a low-relevance match isn't
injected just because it was the closest available one.

### 3.8 `src/memory.py` + `src/personalization.py` — the two forms of "knowing you"

These two modules implement two related but distinct ideas, and mixing them
up is the single most common conceptual mistake a new reader makes:

- **Memory** (`memory.py`) = atomic **facts** ("User works at a bank",
  "User prefers Python"). Extracted every 8 messages by asking a small local
  model to read the transcript and output strict JSON:

  ```python
  _EXTRACT_SYSTEM = (
      "You extract facts about the USER from a conversation... "
      'Output STRICT JSON: a list of objects with keys "content" ... and "category" ...'
  )
  ```

  The model's raw output is then run through a deliberately forgiving parser
  (`_parse_json_list`) that strips markdown code fences and regexes out the
  first `[...]` or `{...}` block — because small local models don't always
  follow "JSON only" instructions perfectly, and the code compensates for
  that rather than trusting it blindly. Before a fact is stored, it's checked
  against existing memories by embedding similarity
  (`rag.similar_memory(..., threshold=0.88)`) so near-duplicates just bump a
  usage counter instead of piling up.

- **Personalization** (`personalization.py`) = one synthesized **prose
  profile** ("Expertise: intermediate Python... Prefers concise answers with
  code examples..."), rebuilt periodically (every `profile_refresh_every`
  conversations) from recent messages *plus* 👍/👎 feedback:

  ```python
  fb_text = "\n".join(f"[{f['rating']:+d}] {f['content'][:300]}" for f in feedback)
  ```

  Memory answers "what does the assistant know *about* the user." Profile
  answers "how should the assistant *behave* for this user." Both get
  injected into the system prompt, but by different code paths — see 3.9.

### 3.9 `src/orchestrator.py` — assembling the prompt

This is the module that turns "everything we know" into "one message list
for the model," and it's short enough to read as a whole:

```python
sections: list[str] = [custom_system.strip() or BASE_SYSTEM]
...
if profile and memory_enabled:
    sections.append(f"## What you know about the user\n{profile}")
if embed_model and memory_enabled:
    mems = memory.relevant_memories(user_text, embed_model)
    ...
if embed_model and cross_chat_enabled:
    hits = rag.search_history(...)
    ...
if embed_model and rag.conv_has_docs(conv_id):
    doc_hits = rag.search_docs(...)
    ...
if attachment_context:
    sections.append(attachment_context)

messages = [{"role": "system", "content": "\n\n".join(sections)}]
for m in history[-20:]:
    messages.append(...)
```

Notice the deliberate **layering order**: system prompt, then profile, then
long-term memory, then cross-chat references, then current-conversation
documents, then this turn's attachments, then recent history (capped at the
last 20 turns — the context-window budget from §1, enforced in code). Each
layer is independently toggleable (`memory_enabled`, `cross_chat_enabled`) and
independently guarded by "do we even have an embedding model" (`embed_model`)
— if the user never pulled an embedding model, every RAG-dependent section
just silently doesn't run, and the assistant still works, just without those
features.

### 3.10 `src/jobs.py` — the background worker (the heart of the legacy app)

This is the module that makes the whole "non-blocking generation" feature
work, and it exists because of one Streamlit constraint stated right in its
docstring:

> Workers must never call `st.*` — Streamlit APIs only work on the main
> script thread.

Streamlit reruns your entire script top-to-bottom on every interaction. If
generating a reply happened inline, the page would freeze until it finished.
So instead:

```python
def start(conv_id, provider, model_name, ...) -> Job:
    job = Job(conv_id=conv_id, model_name=model_name)
    with _lock:
        _jobs[conv_id] = job
    thread = threading.Thread(target=_run, args=(job, ...), daemon=True)
    thread.start()
    return job
```

`start()` returns *immediately* — the actual work happens in `_run`, on a
separate OS thread, writing its progress into a `Job` dataclass sitting in a
process-global `_jobs` dict. The main Streamlit script (in `app.py`) polls
that dict on a timer (`st.fragment(run_every=0.6)`, see 3.11) to render
whatever's there right now. This is a classic **producer/consumer** split: the
worker thread produces text into `job.text`; the UI thread consumes and
displays it — coordinated by nothing more than a `threading.Lock` around
dict access.

`_run` itself is a two-phase pipeline:

```python
# Phase 1: prepare
attachment_context, images = _process_attachments(...)
if web_search:
    sources = _web_search(user_text)
messages, references = build_messages(...)   # orchestrator.py, §3.9
...
# Phase 2: generate
for chunk in _stream(provider, model_name, messages, temperature, stats):
    if job.cancelled:
        return                                 # discard partial output
    parts.append(chunk)
    job.text = "".join(parts)
...
chat_store.add_message(job.conv_id, "assistant", answer, meta)
```

Notice cancellation is checked **between chunks**, not preemptively — you
can't forcibly kill a thread mid-network-call in Python, so `stop()` just
sets a flag and the loop honors it at the next opportunity. Also notice: the
answer is only persisted to SQLite *after* the full stream completes
successfully — a cancelled or failed generation is never half-saved.

After the reply is saved, three "best-effort" steps run — auto-titling the
first message, indexing this exchange for future cross-chat recall, and
(every 8 messages) extracting new memories — each wrapped so a failure there
never breaks the actual reply the user already has on screen:

```python
try:
    if is_first_turn and helper_model:
        _autotitle(...)
    if embed_model:
        after_turn_indexing(...)
    if memory_on and helper_model and embed_model:
        _maybe_extract(...)
except Exception:
    logger.exception("post-processing failed for {}", job.conv_id)
```

### 3.11 `app.py` — tying it together

Now we can trace the full journey. In `app.py`:

```python
def send_user_message(user_text, raw_files) -> None:
    conv_id = st.session_state.get("conv_id") or chat_store.create_conversation(...)
    chat_store.add_message(conv_id, "user", user_text, att_meta or None)
    start_generation(conv_id, user_text, raw_files, history=..., is_first_turn=...)
```

1. The user's message is persisted **immediately** (so it survives even if
   generation later fails) — this is `chat_store.add_message`, §3.2.
2. `start_generation` calls `jobs.start(...)` — §3.10 — which spawns the
   worker thread and returns instantly.
3. `st.rerun()` (called right after, in the chat-input handler at the bottom
   of the file) triggers Streamlit's next script pass.
4. On that (and every subsequent) rerun, this fragment renders whatever the
   job currently has:

   ```python
   @st.fragment(run_every=0.6)
   def render_live_generation(conv_id: str) -> None:
       job = jobs.get(conv_id)
       if job.status != "running":
           jobs.clear(conv_id)
           st.rerun(scope="app")
           return
       ...
       st.markdown(job.text + " <span class='blink-cursor'>▌</span>", unsafe_allow_html=True)
   ```

   `st.fragment(run_every=0.6)` means *only this function* reruns every
   600ms — not the whole page — which is why you can scroll, switch tabs, or
   click elsewhere while a reply streams in.
5. Once `jobs._run` (§3.10) sets `job.status = "done"` and persists the
   answer, the next fragment tick sees the status change, clears the job, and
   a full rerun shows the final, saved message from `chat_store.get_messages`
   like any other historical turn.

That's the entire legacy request lifecycle: **UI writes immediately → hands
off to a thread → polls a shared dict → thread persists on completion → UI
reads the persisted truth.**

---

## Part 4 — The v2 stack (FastAPI + React): the target architecture

Same underlying goals — persist a conversation, stream a reply without
blocking — built on an async web framework instead of a scripting UI
framework. We'll trace the same kind of journey: **a client calls `POST
/api/v1/runs`.**

### 4.1 `backend/app/contracts.py` — one file, every shape

```python
class MessageCreate(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str = Field(min_length=1)

class Message(MessageCreate):
    id: str
    position: int
    created_at: str
```

This is [Pydantic](https://docs.pydantic.dev/latest/) — every field is
validated automatically (role must be one of four literal strings; content
can't be empty) before your route function ever runs. Notice the **inheritance
pattern**: `Message` extends `MessageCreate`, adding only the fields the
server generates (`id`, `position`, `created_at`) that a client should never
be allowed to supply itself. You'll see this "Create" vs. full-record split
repeated for `Conversation`/`ConversationCreate` too — it's the standard way
to stop a client from injecting fields it has no business setting (this is
literally what security engineers call "mass assignment prevention").

```python
class RunStatus(StrEnum):
    queued = "queued"
    running = "running"
    completed = "completed"
    cancelled = "cancelled"
    failed = "failed"
```

A `StrEnum` — this both constrains the value to these five strings *and*
serializes as a plain string in JSON, so the frontend doesn't need to know
it's talking to a Python enum at all.

### 4.2 `backend/app/store.py` — SQLite, v2 style

Structurally similar to §3.2's `chat_store.py` — parameterized queries,
`sqlite3.Row` for dict-like rows — but with one small, deliberate difference
worth noticing:

```python
def __init__(self, database_url: str) -> None:
    self.connection = sqlite3.connect(database_url, check_same_thread=False)
    self.lock = threading.RLock()
```

**One long-lived connection**, shared across requests, guarded by an
`RLock`. This works because FastAPI can serve many requests "concurrently"
on one thread (via `asyncio`) but a sync route like this one still ends up
running on a worker thread pool — `check_same_thread=False` plus an explicit
lock is what makes that safe. Compare to §3.2's "one connection per call" —
different tradeoff, same underlying constraint (SQLite connections aren't
free to share carelessly across threads).

```python
def add_message(self, conversation_id, role, content) -> Message:
    with self.lock, self.connection:
        ...
        position = self.connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM messages WHERE conversation_id = ?",
            (conversation_id,),
        ).fetchone()[0]
        self.connection.execute("INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?)", (...))
```

The "next position" calculation and the insert happen **inside the same
lock and the same transaction** — that's what guarantees two messages in the
same conversation can never collide on the same position number, even under
concurrent requests.

### 4.3 `backend/app/sessions.py` — the v2 credential vault

```python
class SessionVault:
    def __init__(self) -> None:
        self._values: dict[str, dict[str, str]] = {}
        self._lock = threading.RLock()

    def get(self, session_id: str, provider: str) -> str | None:
        with self._lock:
            value = self._values.get(session_id, {}).get(provider)
        return value or os.getenv(PROVIDER_ENV[provider])
```

Same idea as §3.5's legacy secrets dict, but now keyed by **browser session**
(`session_id`) rather than being one global dict for the whole process —
because unlike Streamlit (one server process per user, typically), a FastAPI
server can serve multiple browsers at once, so credentials must be
partitioned per session. This `session_id` comes from a cookie set by
`main.py`'s middleware — which brings us to the file where this session's
own real bug lived.

### 4.4 `backend/app/providers.py` — the adapter pattern, for real

```python
class ProviderAdapter(ABC):
    @abstractmethod
    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]: ...
    @abstractmethod
    async def stream(self, api_key, model, messages, temperature) -> AsyncIterator[str]: ...
```

An [abstract base class](https://docs.python.org/3/library/abc.html) defines
a contract; four concrete classes implement it (`OllamaAdapter`,
`OpenAICompatibleAdapter`, `AnthropicAdapter`, `GeminiAdapter`). This is
textbook polymorphism, and it's *earned* here — not a speculative "just in
case" abstraction — because there are genuinely four different wire
protocols being normalized into one shape. `OpenAICompatibleAdapter` alone
gets reused for OpenAI, Agnes AI, OpenRouter, xAI, OmniRoute, and OpenCode Go
by pointing it at a different `base_url`, since they speak the same OpenAI-style
API. `OPENAI_BASE_URL` may override OpenAI; Agnes uses
`https://apihub.agnes-ai.com/v1` and `AGNES_API_KEY`.

```python
async def discover_models(self, credential) -> dict[str, ProviderDiscovery]:
    async def discover(provider, adapter) -> ProviderDiscovery:
        try:
            return ProviderDiscovery(provider=provider, models=await adapter.list_models(credential(provider)))
        except Exception as exc:
            return ProviderDiscovery(provider=provider, error=str(exc))
    results = await asyncio.gather(*(discover(p, a) for p, a in self.adapters.items()))
    return {r.provider: r for r in results}
```

`asyncio.gather` fires all providers' model lookups **concurrently** — one
slow or broken provider (say, a bad API key) doesn't delay or fail the
others, because each `discover()` call catches its own exception and turns
it into a `ProviderDiscovery(error=...)` result instead of raising. This is
"isolated failure," a common pattern any time you fan out to multiple
independent, possibly-flaky external services.

After discovery, `backend/app/pricing.py` attaches optional `ModelPricing`
metadata. Its static rates are dated and link to official provider pages;
OpenRouter's per-token values come from its live Models API and are normalized
to dollars per million tokens. The UI multiplies the preflight input estimate by
that input rate. It deliberately shows **pricing unavailable** for unverified
custom gateways rather than guessing.

### 4.5 `backend/app/runs.py` — the async run lifecycle

```python
def create(self, request: RunCreate, session_id: str) -> RunSnapshot:
    run_id = str(uuid.uuid4())
    snapshot = RunSnapshot(id=run_id, status=RunStatus.queued, ...)
    state = RunState(snapshot=snapshot)
    with self._lock:
        self._runs[run_id] = state
    asyncio.create_task(self._execute(state, request, session_id))
    return snapshot
```

`asyncio.create_task` schedules `_execute` to run on the event loop *without
waiting for it* — `create()` returns the `queued` snapshot to the caller
immediately, exactly like `jobs.start()` did with a thread in §3.10, just
using `asyncio` cooperative scheduling instead of an OS thread (see the
concurrency-models note in §1).

```python
async def _execute(self, state, request, session_id) -> None:
    state.snapshot.status = RunStatus.running
    ...
    async for delta in stream:
        if state.cancel.is_set():
            state.snapshot.status = RunStatus.cancelled
            return
        state.snapshot.output += delta
        self._emit(state, "run.delta", {"delta": delta})
        await asyncio.sleep(0)
```

`await asyncio.sleep(0)` is a deliberate cooperative yield — it hands control
back to the event loop for one tick so other pending work (like a client
polling `/events`) gets a chance to run, even though this loop has more
`delta`s ready immediately. Without it, a fast-streaming provider could
starve every other concurrent request.

```python
async def events(self, run_id: str) -> AsyncIterator[RunEvent]:
    state, offset = self._state(run_id), 0
    while True:
        while offset < len(state.events):
            yield state.events[offset]
            offset += 1
        if state.snapshot.status in terminal:
            return
        state.changed.clear()
        await state.changed.wait()
```

This is the server side of Server-Sent Events (§1): a generator that yields
every event *already* recorded, then **waits** (via an `asyncio.Event`) for
`_emit` to signal a new one, rather than polling in a loop. `main.py` wraps
this generator directly into a `StreamingResponse` with
`media_type="text/event-stream"` — that's the entire SSE implementation, no
extra library required.

> **A real bug lived right next to this code, and it's worth reading as a
> case study.** `asyncio.create_task(...)`'s return value is discarded on
> line 41 above — nothing keeps a strong reference to that task object. Per
> the [asyncio docs](https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task),
> a task with no remaining references is eligible for garbage collection
> *mid-run*, which could silently kill an in-flight generation with no error
> ever surfacing. The current `RunManager` keeps tasks in `self._tasks` and
> discards them from a done callback, then `shutdown()` awaits the set.
> Internalize the rule: **if you don't keep the task object, Python is
> allowed to throw it away.**

### 4.6 `backend/app/main.py` — composition root, and a live bug-fix case study

```python
def create_app(database_url=None, provider_registry=None, shutdown_callback=None) -> FastAPI:
    store = Store(database_url or str(data_dir / "app.db"))
    vault = SessionVault()
    registry = provider_registry or ProviderRegistry(build_provider_registry())
    runs = RunManager(registry, vault, store)
    app = FastAPI(..., lifespan=lifespan)
    ...
    return app
```

This is the **composition root** — the one place that constructs every
top-level object and wires them together. Dependency injection (the
optional `database_url`/`provider_registry` parameters) is what lets the test
suite build an app with a fake `:memory:` database and a fake provider
registry, entirely deterministically, with no real network calls.

Now, the session cookie middleware — read carefully, because this is where a
real, verified bug lived in this exact codebase until this session:

```python
@app.middleware("http")
async def session_cookie(request: Request, call_next):
    session_id = request.cookies.get("chat_session") or vault.new_id()
    request.state.session_id = session_id
    response = await call_next(request)
    if "chat_session" not in request.cookies:
        response.set_cookie("chat_session", session_id, httponly=True, samesite="lax", secure=False)
    return response
```

That `samesite="lax"` used to read `samesite="strict"`. Here's why that one
word broke a whole feature, and why the theory from a moment ago
([PKCE](https://www.rfc-editor.org/rfc/rfc7636), §3.5) matters:

```python
@app.post("/api/v1/providers/openrouter/auth/start")
def start_openrouter_auth(request: Request) -> dict[str, str]:
    verifier = secrets.token_urlsafe(64)
    oauth_verifiers[request.state.session_id] = verifier   # keyed by THIS session
    ...

@app.get("/api/v1/providers/openrouter/auth/callback")
async def openrouter_auth_callback(code: str, request: Request) -> RedirectResponse:
    await exchange_openrouter_code(code, request.state.session_id)   # needs the SAME session
    ...

async def exchange_openrouter_code(code, session_id):
    verifier = oauth_verifiers.pop(session_id, None)
    if verifier is None:
        raise HTTPException(409, "No OpenRouter authorization is pending")
```

The callback is reached because *openrouter.ai* redirects the user's browser
back to this app — that redirect is a **cross-site top-level navigation**
(the browser is going from `openrouter.ai` to your app's own domain).
Cookies marked `SameSite=Strict` are withheld by the browser on exactly that
kind of request. So the callback arrived with no `chat_session` cookie, the
middleware minted a *brand-new* `session_id`, and `oauth_verifiers.pop(new_id)`
never found the verifier that had been stored under the *original* session —
guaranteed `409` on every single real attempt. `SameSite=Lax` is the
standards-correct fix here: it still sends the cookie on a cross-site
top-level **GET** navigation (this callback), while continuing to withhold
it on cross-site `POST`/`PUT`/`DELETE` — which is every state-changing route
in this API — so CSRF protection on those routes is completely unaffected by
the change. This is a genuinely common real-world gotcha with cookie-based
OAuth callbacks, and now you've seen it fail and get fixed in a real
codebase, not just in the abstract.

Also worth noticing, because it's the same "route notation contract" idea
from §4.1 in action: every route declares `response_model=`:

```python
@app.post("/api/v1/conversations", response_model=Conversation, status_code=201)
def create_conversation(payload: ConversationCreate) -> Conversation:
    return store.create_conversation(payload.title)
```

FastAPI validates the *return value* against `Conversation` too — so even if
`store.create_conversation` accidentally returned extra internal fields
someday, the client would only ever see the shape declared here.

### 4.7 `backend/app/cli.py` — the entrypoint

```python
def main() -> None:
    def shutdown() -> None:
        server.should_exit = True

    server = uvicorn.Server(
        uvicorn.Config(
            create_app(shutdown_callback=shutdown),
            host="127.0.0.1",
            port=8506,
            reload=False,
            log_level="info",
        )
    )
    server.run()
```

[Uvicorn](https://www.uvicorn.org/) is the ASGI server that actually accepts
TCP connections and hands them to FastAPI. `host="127.0.0.1"` is a security
boundary, not an accident — it means the server only accepts connections
from the same machine, so "no built-in authentication" (true throughout this
API) is an acceptable tradeoff *as long as* this stays loopback-only. Binding
`0.0.0.0` here would expose every unauthenticated route to the network.
Port **8506** is the default in v0.4.0. The shutdown callback is what
Settings **Stop Studio** uses after `RunManager.shutdown()` cancels active
runs.

### 4.8 `frontend/` — the current React workspace

`frontend/src/App.tsx` is the live workspace: Chat, Compare, Providers,
Library, Activity, and Settings. `frontend/src/api/client.ts` is the typed
client for conversations, preflight, SSE runs, memory, OpenCode auth, data
controls, and `api.shutdown()`. Vite's `npm run dev` proxies `/api` to
`http://127.0.0.1:8506`. TypeScript is pinned to 5.9.

The Compare workspace holds two to four distinct `provider::model` selections.
Submitting one prompt creates every run concurrently with `Promise.allSettled`, then
maps each SSE stream back to its result card. A failed provider updates only its card;
**Cancel all** aborts every stream and calls the existing run-cancellation endpoint
for each created run. `gpt-5.6-luna` uses the OpenAI adapter without a custom
temperature because its API accepts only the model default, while Agnes
`agnes-2.5-flash` uses the dedicated official OpenAI-compatible endpoint.

A focused contribution is still a small vertical slice — for example
tightening one Settings or Providers control plus a Vitest case — but the
old “UI is a static shell” description is no longer true.

---

## Part 5 — Two full traces, side by side

**Legacy (Streamlit), one chat turn:**

```
st.chat_input "hello"
  → app.py: send_user_message()
      → chat_store.add_message(user turn)      [§3.2 — saved immediately]
      → jobs.start()                            [§3.10 — spawns a thread, returns instantly]
  → st.rerun()
  → render_live_generation() fragment, polling every 0.6s
      ← jobs._run() on its own thread:
            _process_attachments()               [§3.6 — parse any uploads]
            build_messages()                     [§3.9 — assemble the prompt]
            ollama_stream() / providers.stream_chat()  [§3.3/3.5 — token by token]
            chat_store.add_message(assistant turn)  [§3.2 — saved on completion]
  → fragment sees status == "done" → full rerun renders the saved message
```

**v2 (FastAPI), one run:**

```
POST /api/v1/runs {provider, model, messages}
  → session_cookie middleware assigns/reads session_id   [§4.6]
  → RunManager.create()                                   [§4.5 — returns "queued" instantly]
      asyncio.create_task(_execute(...))
GET /api/v1/runs/{id}/events   (SSE, opened by the client right after)
  ← RunManager.events() yields run.started, then run.delta × N, then one terminal event
  ← meanwhile _execute() calls the right ProviderAdapter.stream()  [§4.4]
GET /api/v1/runs/{id}   → returns the final RunSnapshot with accumulated output
```

Same shape at the conceptual level — save-fast, hand-off-work,
stream-progress, persist-on-completion — implemented with completely
different concurrency primitives because the two web frameworks demand it.

---

## Part 6 — Where to go from here

- **Use the app to build intuition first**, then re-read whichever section
  above maps to the feature you just used — [USER_GUIDE.md](USER_GUIDE.md)
  covers every feature from the user's side.
- **Reference tables, glossary, module atlas, contributor recipes**:
  [ZERO_TO_HERO_STUDY_HANDBOOK.md](ZERO_TO_HERO_STUDY_HANDBOOK.md).
- **Try the exercises the handbook already has** (§13) — tracing a run with
  the `echo` provider with no real model needed is a good first one.
- **A good second read**: `tests/test_provider_adapters.py` and
  `tests/test_api_contract.py` — tests are executable proof of what each
  module in Part 4 is actually guaranteed to do.
- **A good first contribution**: a focused UI or contract change with a
  matching test. See [CONTRIBUTING.md](CONTRIBUTING.md). The old “wire the
  static shell” gap list is obsolete as of v0.4.0.
