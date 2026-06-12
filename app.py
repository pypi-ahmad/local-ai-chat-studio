"""Local AI Chat Studio — ChatGPT-style UI over Ollama + BYOK cloud providers."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

import streamlit as st
from loguru import logger

from src import chat_store, jobs, memory, providers, rag
from src.catalog import (
    PROVIDER_BADGES,
    best_coding_model,
    build_model_catalog,
    normalize_model_key,
    ordered_keys,
    present_groups,
)
from src.config import config
from src.files import ACCEPTED_TYPES, IMAGE_TYPES
from src.ollama_client import (
    ModelInfo,
    embedding_model,
    list_models,
    ollama_alive,
    running_models,
    smallest_text_model,
    vision_fallback_model,
)
from src.personalization import note_conversation_done, rebuild_profile

st.set_page_config(page_title="Chat Studio", page_icon="✦", layout="wide")
chat_store.init_db()

MEMORY_EXTRACT_EVERY = 8  # messages

APP_CSS = """
<style>
/* Hide Streamlit chrome (Deploy button, hamburger menu, footer). */
header [data-testid="stToolbar"] { visibility: hidden; }
#MainMenu, footer { visibility: hidden; }

/* Animated "assistant is thinking" dots + streaming cursor. */
@keyframes lacs-blink { 0%, 80%, 100% { opacity: .25; transform: translateY(0); }
                        40% { opacity: 1; transform: translateY(-3px); } }
.lacs-typing { display: inline-flex; gap: 6px; align-items: center; padding: 6px 2px; }
.lacs-typing span { width: 8px; height: 8px; border-radius: 50%; background: currentColor;
                    opacity: .4; animation: lacs-blink 1.4s infinite both; }
.lacs-typing span:nth-child(2) { animation-delay: .2s; }
.lacs-typing span:nth-child(3) { animation-delay: .4s; }
@keyframes lacs-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.blink-cursor { animation: lacs-cursor 1s steps(1) infinite; font-weight: bold; }

/* User messages on the right (ChatGPT-style), with a subtle bubble. */
div[data-testid="stChatMessage"]:has([aria-label="Chat message from user"]),
div[aria-label="Chat message from user"] {
    flex-direction: row-reverse;
    text-align: right;
    background-color: rgba(45, 212, 191, 0.07);
    border-radius: 14px;
    padding: 0.6rem 0.9rem;
}
div[data-testid="stChatMessage"]:has([aria-label="Chat message from user"]) p {
    text-align: right;
}
</style>
"""
TYPING_HTML = (
    "<div class='lacs-typing' aria-label='Assistant is thinking'>"
    "<span></span><span></span><span></span></div>"
)
st.markdown(APP_CSS, unsafe_allow_html=True)

AVATARS = {"user": "🧑‍💻", "assistant": "🤖"}

PROMPT_CHIPS = [
    ("📄 Summarize a document", "Summarize the key points of the document I am about to upload. Ask me to attach it if I haven't."),
    ("🐍 Explain some code", "I'll paste some code — explain what it does, point out bugs or smells, and suggest improvements."),
    ("💡 Brainstorm ideas", "Help me brainstorm. Ask me 3 sharp questions about my goal first, then give 10 ideas ranked by impact."),
    ("📚 Teach me something", "Teach me a concept I name, like I'm smart but new to it. Use one analogy, one example, and a 3-question quiz."),
]

CODING_AGENT_PROMPT = """You are an expert senior software engineer acting as a coding agent.

Rules:
- If the request is ambiguous, ask the single most important clarifying question first.
- Produce complete, runnable code — no placeholders like "..." or "TODO".
- Follow the user's existing style; prefer modern idioms and type hints in Python.
- After code, add a short "How it works" (≤4 bullets) and "How to test it" (commands or cases).
- When you change existing code, show only the changed part with enough context to apply it.
- Think about edge cases, error handling at system boundaries, and security (no secrets in code).
- If web search results are provided, cite them as [n]."""


@st.cache_data(ttl=60, show_spinner=False)
def cached_models() -> list[ModelInfo]:
    return list_models()


@st.cache_data(ttl=300, show_spinner=False)
def cached_provider_models(provider: str) -> list[providers.ApiModel]:
    try:
        return providers.list_provider_models(provider)
    except Exception as exc:
        logger.warning("model listing failed for {}: {}", provider, exc)
        return []


def get_state(key: str, default=None):
    if key not in st.session_state:
        st.session_state[key] = default
    return st.session_state[key]


def switch_conversation(conv_id: str | None, catalog) -> None:
    """Change active conversation, extracting memories from the one we leave."""
    prev = st.session_state.get("conv_id")
    if prev and not jobs.is_running(prev) and st.session_state.get("settings_memory", config.memory_enabled):
        _maybe_extract_memories(prev, force=True)
    st.session_state.conv_id = conv_id
    if conv_id:  # restore the model this conversation was using, if still available
        conv = chat_store.get_conversation(conv_id)
        if conv:
            key = normalize_model_key(conv["model"])
            if key in catalog:
                # Applied at the top of the next run, before widgets exist —
                # session keys backing live widgets must not be written here.
                st.session_state.pending_filter = "All"
                st.session_state.pending_model = key


def _maybe_extract_memories(conv_id: str, force: bool = False) -> None:
    conv = chat_store.get_conversation(conv_id)
    if not conv:
        return
    n = chat_store.message_count(conv_id)
    if n == 0:
        return
    already = conv["memory_extracted_at"] and conv["memory_extracted_at"] >= conv["updated_at"]
    due = force or (n % MEMORY_EXTRACT_EVERY == 0)
    helper = st.session_state.get("helper_model")
    embed = st.session_state.get("embed_model")
    if due and not already and helper and embed:
        with st.spinner("Updating memory..."):
            memory.extract_memories(conv_id, helper, embed)
        if note_conversation_done():
            with st.spinner("Refreshing your profile..."):
                rebuild_profile(helper)


def _feedback_widget(message_id: str, current: dict[str, int]) -> None:
    existing = current.get(message_id)
    score = st.feedback("thumbs", key=f"fb_{message_id}")
    if score is not None:
        rating = 1 if score == 1 else -1
        if rating != existing:
            chat_store.set_feedback(message_id, rating)


def start_generation(conv_id: str, user_text: str, raw_files: list[tuple[str, bytes]],
                     history: list[dict], is_first_turn: bool) -> None:
    """Queue a background generation with the current settings."""
    fallback = vision_fallback_model(cached_models())
    sel = st.session_state.catalog[st.session_state.selected_model]
    jobs.start(
        conv_id=conv_id,
        provider=sel.provider,
        model_name=sel.name,
        is_vision=sel.is_vision,
        user_text=user_text,
        raw_files=raw_files,
        history=history,
        custom_system=get_state("settings_system_prompt", ""),
        temperature=get_state("settings_temperature", config.temperature),
        embed_model=st.session_state.embed_model,
        helper_model=st.session_state.helper_model,
        vision_fallback=fallback.name if fallback else None,
        memory_on=get_state("settings_memory", config.memory_enabled),
        crosschat_on=get_state("settings_crosschat", config.cross_chat_references),
        is_first_turn=is_first_turn,
        web_search=get_state("web_search_on", False),
    )


def send_user_message(user_text: str, raw_files: list[tuple[str, bytes]]) -> None:
    """Persist the user's message immediately and queue generation."""
    conv_id = st.session_state.get("conv_id")
    if conv_id is None:
        conv_id = chat_store.create_conversation(st.session_state.selected_model)
        st.session_state.conv_id = conv_id
    history_msgs = chat_store.get_messages(conv_id)
    att_meta = [
        {"name": n, "kind": "image" if n.rsplit(".", 1)[-1].lower() in IMAGE_TYPES else "document"}
        for n, _ in raw_files
    ]
    chat_store.add_message(conv_id, "user", user_text, att_meta or None)
    start_generation(
        conv_id, user_text, raw_files,
        history=[
            {"role": m["role"], "content": m["content"]}
            for m in history_msgs
            if not any(a.get("kind") == "error" for a in m["attachments"])
        ],
        is_first_turn=len(history_msgs) == 0,
    )


def regenerate_last(history_msgs: list[dict]) -> None:
    """Delete the last assistant reply and regenerate it with the current model."""
    conv_id = st.session_state.conv_id
    last = history_msgs[-1]
    if last["role"] != "assistant":
        return
    user_idx = next(
        (i for i in range(len(history_msgs) - 2, -1, -1) if history_msgs[i]["role"] == "user"), None
    )
    if user_idx is None:
        return
    chat_store.delete_messages_from(conv_id, last["ts"])
    start_generation(
        conv_id,
        user_text=history_msgs[user_idx]["content"],
        raw_files=[],
        history=[
            {"role": m["role"], "content": m["content"]}
            for m in history_msgs[:user_idx]
            if not any(a.get("kind") == "error" for a in m["attachments"])
        ],
        is_first_turn=False,
    )


def seed_builtin_presets(catalog) -> None:
    if catalog and not chat_store.get_preset_by_name("🧑‍💻 Coding Agent"):
        model_key = best_coding_model(catalog)
        if model_key:
            chat_store.save_preset(
                "🧑‍💻 Coding Agent", CODING_AGENT_PROMPT, model_key, 0.2, builtin=True
            )


def apply_preset(name: str, catalog) -> None:
    """Apply an assistant preset (system prompt + model + temperature)."""
    if name == "✨ Default":
        st.session_state.settings_system_prompt = ""
        st.session_state.settings_temperature = config.temperature
        return
    p = chat_store.get_preset_by_name(name)
    if not p:
        return
    st.session_state.settings_system_prompt = p["system_prompt"]
    st.session_state.settings_temperature = p["temperature"]
    key = normalize_model_key(p["model_key"])
    if key in catalog:
        st.session_state.pending_filter = "All"
        st.session_state.pending_model = key


def date_bucket(iso_ts: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_ts)
    except ValueError:
        return "Older"
    now = datetime.now(timezone.utc)
    d = dt.date() if dt.tzinfo else dt.replace(tzinfo=timezone.utc).date()
    today = now.date()
    if d == today:
        return "Today"
    if d == today - timedelta(days=1):
        return "Yesterday"
    if d >= today - timedelta(days=7):
        return "Previous 7 days"
    return "Older"


@st.fragment(run_every=0.6)
def render_live_generation(conv_id: str) -> None:
    """Auto-refreshing view of an in-flight reply (only this block reruns)."""
    job = jobs.get(conv_id)
    if job is None:
        return
    if job.status != "running":
        jobs.clear(conv_id)
        st.rerun(scope="app")
        return
    with st.chat_message("assistant", avatar=AVATARS["assistant"]):
        if job.references:
            st.caption("🔗 referencing: " + " · ".join(f"_{r}_" for r in job.references))
        if job.text:
            st.markdown(job.text + " <span class='blink-cursor'>▌</span>", unsafe_allow_html=True)
        else:
            st.markdown(TYPING_HTML, unsafe_allow_html=True)
            if job.phase == "preparing":
                note = f" — {job.notes[-1]}" if job.notes else ""
                st.caption(f"📚 reading files & gathering context{note}…")
        waited = job.elapsed()
        if waited > 20 and not job.text:
            st.caption(
                f"⏳ Still waiting for the model… {int(waited)}s. It may be loading into "
                "memory (slow on first use / limited VRAM). You can **Stop** and try a smaller model."
            )
        if st.button("⏹ Stop", key=f"stop_{conv_id}"):
            jobs.stop(conv_id)
            st.rerun(scope="app")


@st.fragment(run_every=15)
def render_health() -> None:
    """Tiny endpoint health row: latency + which models are loaded."""
    t0 = time.perf_counter()
    ok = ollama_alive()
    ms = (time.perf_counter() - t0) * 1000
    if not ok:
        st.caption("🔴 Ollama unreachable")
        return
    dot = "🟢" if ms < 400 else ("🟠" if ms < 2000 else "🔴")
    loaded = running_models()
    loaded_txt = ", ".join(f"{m['name']} ({m['size_gb']:.1f}G)" for m in loaded[:2]) or "none"
    st.caption(f"{dot} Ollama {ms:.0f} ms · loaded: {loaded_txt}")


# --- startup -------------------------------------------------------------------

if not ollama_alive():
    st.error(
        f"Cannot reach Ollama at `{providers.get_ollama_host()}`. "
        "Start it with `ollama serve`, or set the endpoint on the **Providers** page, then reload."
    )
    st.stop()

models = cached_models()
show_cloud = get_state("settings_show_cloud", config.show_cloud_models)
provider_models = {p: cached_provider_models(p) for p in providers.configured_providers()}
catalog = build_model_catalog(models, show_cloud, provider_models)
st.session_state.catalog = catalog
embed_info = embedding_model(models)
st.session_state.embed_model = embed_info.name if embed_info else None
helper_info = smallest_text_model(models)
st.session_state.helper_model = helper_info.name if helper_info else None
seed_builtin_presets(catalog)

# Apply deferred widget-state changes BEFORE any widget is instantiated.
pending_filter = st.session_state.pop("pending_filter", None)
if pending_filter:
    st.session_state.provider_filter = pending_filter
pending_model = st.session_state.pop("pending_model", None)
if pending_model and pending_model in catalog:
    st.session_state.selected_model = pending_model

# --- sidebar -------------------------------------------------------------------

with st.sidebar:
    st.title("✦ Chat Studio")

    if not catalog:
        st.warning("No models available. Start Ollama or add a provider key on **Providers**.")
        st.stop()

    # Assistant presets (saved system prompt + model + temperature bundles).
    # on_change fires only on a real user change — the preset's model lands in
    # pending_model, which the next script run applies before the selectbox.
    preset_names = ["✨ Default"] + [p["name"] for p in chat_store.list_presets()]

    def _on_preset_change() -> None:
        apply_preset(st.session_state.preset_pick, st.session_state.catalog)

    st.selectbox("Assistant", preset_names, key="preset_pick", on_change=_on_preset_change)

    groups = present_groups(catalog)
    filter_options = ["All"] + groups
    if st.session_state.get("provider_filter") not in filter_options:
        st.session_state.provider_filter = "All"

    fcol, rcol = st.columns([4, 1])
    with fcol:
        provider_filter = st.selectbox(
            "Provider",
            options=filter_options,
            format_func=lambda g: ("🌐 All providers" if g == "All"
                                    else f"{PROVIDER_BADGES.get(g, '🔌')} {g}"),
            key="provider_filter",
        )
    with rcol:
        st.write("")
        if st.button("⟳", help="Refresh model lists (Ollama + providers)"):
            cached_models.clear()
            cached_provider_models.clear()
            st.rerun()

    model_keys = ordered_keys(catalog, provider_filter)
    if st.session_state.get("selected_model") not in model_keys:
        st.session_state.pop("selected_model", None)

    show_group = provider_filter == "All"

    def _model_label(k: str) -> str:
        sm = catalog[k]
        head = f"{sm.badge} {sm.group} · " if show_group else f"{sm.badge} "
        return f"{head}{sm.name} — {sm.hint}"

    selected_key = st.selectbox("Model", options=model_keys, format_func=_model_label,
                                key="selected_model")
    selected = catalog[selected_key]
    st.caption(f"**{selected.badge} {selected.group}** · {selected.hint}")

    st.toggle("🌐 Web search (DuckDuckGo, cited)", key="web_search_on",
              help="Search the web for each question and cite sources in the reply.")

    if not embed_info:
        st.caption("⚠️ No embedding model — memory & RAG off. `ollama pull embeddinggemma`")

    if st.button("➕ New chat", use_container_width=True, type="primary"):
        switch_conversation(None, catalog)
        st.rerun()

    st.divider()
    search_q = st.text_input("Search", key="conv_search", placeholder="🔎 Search chats…",
                             label_visibility="collapsed")

    running = jobs.running_conversations()
    convs = chat_store.list_conversations(limit=100)
    if search_q.strip():
        match_ids = set(chat_store.search_conversations(search_q.strip()))
        if st.session_state.embed_model:  # add semantic hits
            try:
                for h in rag.search_history_all(st.session_state.embed_model, search_q.strip()):
                    match_ids.add(h.get("conv_id"))
            except Exception as exc:
                logger.warning("semantic search failed: {}", exc)
        convs = [c for c in convs if c["id"] in match_ids]

    def render_conv_row(conv: dict) -> None:
        active = st.session_state.get("conv_id") == conv["id"]
        c1, c2 = st.columns([5, 1])
        with c1:
            prefix = "⏳ " if conv["id"] in running else ("● " if active else "")
            if st.button(prefix + conv["title"], key=f"conv_{conv['id']}",
                         use_container_width=True):
                switch_conversation(conv["id"], catalog)
                st.rerun()
        with c2:
            with st.popover("⋯"):
                new_title = st.text_input("Rename", value=conv["title"], key=f"rn_{conv['id']}")
                if new_title != conv["title"] and new_title.strip():
                    chat_store.rename_conversation(conv["id"], new_title.strip()[:60])
                    st.rerun()
                pin_label = "📌 Unpin" if conv.get("pinned") else "📌 Pin"
                if st.button(pin_label, key=f"pin_{conv['id']}", use_container_width=True):
                    chat_store.set_pinned(conv["id"], not conv.get("pinned"))
                    st.rerun()
                st.download_button(
                    "⬇️ Export (.md)",
                    data=chat_store.export_conversation_markdown(conv["id"]),
                    file_name=f"{conv['title'][:40]}.md",
                    mime="text/markdown",
                    key=f"exp_{conv['id']}",
                    use_container_width=True,
                )
                if st.button("🗑 Delete", key=f"del_{conv['id']}", use_container_width=True):
                    chat_store.delete_conversation(conv["id"])
                    rag.delete_conv_vectors(conv["id"])
                    if active:
                        st.session_state.conv_id = None
                    st.rerun()

    pinned = [c for c in convs if c.get("pinned")]
    others = [c for c in convs if not c.get("pinned")]
    if running:
        st.caption(f"⏳ {len(running)} generating")
    if pinned:
        st.caption("📌 Pinned")
        for conv in pinned:
            render_conv_row(conv)
    bucket_shown: set[str] = set()
    for conv in others:
        bucket = date_bucket(conv["updated_at"])
        if bucket not in bucket_shown:
            bucket_shown.add(bucket)
            st.caption(bucket)
        render_conv_row(conv)

    st.divider()
    render_health()

# --- main chat area ---------------------------------------------------------------

conv_id = st.session_state.get("conv_id")
if conv_id and not chat_store.get_conversation(conv_id):  # stale after wipe/clear
    conv_id = None
    st.session_state.conv_id = None

# A prompt chip was clicked on the previous run — send it now.
queued = st.session_state.pop("queued_prompt", None)
if queued and not jobs.is_running(conv_id):
    send_user_message(queued, [])
    st.rerun()

history_msgs = chat_store.get_messages(conv_id) if conv_id else []
feedback_map = chat_store.get_feedback(conv_id) if conv_id else {}

if not history_msgs and not jobs.get(conv_id):
    st.markdown(f"## ✦ Chat with `{selected.name}`")
    st.caption(f"{selected.hint} — attach files or images with 📎, or start from an idea:")
    chip_cols = st.columns(len(PROMPT_CHIPS))
    for col, (label, chip_prompt) in zip(chip_cols, PROMPT_CHIPS):
        with col:
            if st.button(label, key=f"chip_{label}", use_container_width=True):
                st.session_state.queued_prompt = chip_prompt
                st.rerun()

busy = jobs.is_running(conv_id)

for i, m in enumerate(history_msgs):
    atts = m["attachments"]
    is_error = any(a.get("kind") == "error" for a in atts)
    meta = next((a for a in atts if a.get("kind") == "meta"), None)
    sources = [a for a in atts if a.get("kind") == "source"]
    files_meta = [a for a in atts if a.get("kind") not in ("reference", "error", "meta", "source")]
    refs_meta = [a for a in atts if a.get("kind") == "reference"]
    is_last = i == len(history_msgs) - 1

    with st.chat_message(m["role"], avatar=AVATARS.get(m["role"])):
        if files_meta:
            st.caption("📎 " + ", ".join(a["name"] for a in files_meta))
        if refs_meta:
            st.caption("🔗 referencing: " + " · ".join(f"_{a['name']}_" for a in refs_meta))
        if is_error:
            st.error(m["content"])
            continue
        st.markdown(m["content"])
        if sources:
            st.caption("🌐 sources: " + " · ".join(
                f"[[{j}]]({s['url']})" for j, s in enumerate(sources, 1)))

        if m["role"] == "assistant":
            mc1, mc2, mc3, mc4 = st.columns([2, 1, 1, 8])
            with mc1:
                _feedback_widget(m["id"], feedback_map)
            with mc2:
                with st.popover("📋", help="Copy"):
                    st.code(m["content"], language=None)
            with mc3:
                if is_last and not busy and st.button("🔄", key=f"rg_{m['id']}",
                                                      help="Regenerate with the current model"):
                    regenerate_last(history_msgs)
                    st.rerun()
            if meta:
                bits = [meta.get("model") or "", f"{meta.get('secs', '?')}s"]
                if meta.get("tok_s"):
                    bits.append(f"{meta['tok_s']} tok/s")
                st.caption(" · ".join(str(b) for b in bits if b))
        elif m["role"] == "user" and is_last and not busy:
            with st.popover("✏️ Edit", help="Edit & resend"):
                new_text = st.text_area("Edit your message", value=m["content"], key=f"ed_{m['id']}")
                if st.button("Send", key=f"edsend_{m['id']}", type="primary"):
                    chat_store.delete_messages_from(conv_id, m["ts"])
                    send_user_message(new_text, [])
                    st.rerun()

if jobs.get(conv_id):
    render_live_generation(conv_id)

prompt = st.chat_input(
    "Generating… (open a New chat to ask something else)" if busy else f"Message {selected.name}...",
    accept_file="multiple",
    file_type=ACCEPTED_TYPES,
    disabled=busy,
)

if prompt:
    user_text = prompt.text or ""
    files = prompt.files or []
    if not user_text and files:
        user_text = "Please look at the attached file(s)."
    send_user_message(user_text, [(f.name, f.getvalue()) for f in files])
    st.rerun()
