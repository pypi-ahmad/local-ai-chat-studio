"""Local AI Chat Studio — ChatGPT-style UI over Ollama + BYOK cloud providers."""

from __future__ import annotations

from dataclasses import dataclass

import streamlit as st
from loguru import logger

from src import chat_store, memory, providers, rag
from src.config import config
from src.files import ACCEPTED_TYPES, chunk_text, parse_upload
from src.model_labels import dropdown_label, hint_for
from src.ollama_client import (
    ModelInfo,
    chat_models,
    describe_image,
    embedding_model,
    generate,
    list_models,
    ollama_alive,
    smallest_text_model,
    stream_chat,
    vision_fallback_model,
)
from src.orchestrator import after_turn_indexing, build_messages
from src.personalization import note_conversation_done, rebuild_profile

st.set_page_config(page_title="Local AI Chat Studio", page_icon="🤖", layout="wide")
chat_store.init_db()

MEMORY_EXTRACT_EVERY = 8  # messages


@dataclass
class SelectedModel:
    """Uniform view over an Ollama model or a cloud-provider model."""

    key: str  # 'ollama::<name>' or '<provider>::<id>'
    provider: str
    name: str
    label: str
    hint: str
    is_vision: bool
    context_length: int | None = None


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


def normalize_model_key(value: str) -> str:
    """Old conversations stored bare Ollama names; map them to unified keys."""
    return value if "::" in value else f"ollama::{value}"


def build_model_catalog(models: list[ModelInfo], show_cloud: bool) -> dict[str, SelectedModel]:
    """Unified, ordered {key: SelectedModel} for the dropdown."""
    catalog: dict[str, SelectedModel] = {}
    for m in chat_models(models, include_cloud=show_cloud):
        key = f"ollama::{m.name}"
        catalog[key] = SelectedModel(
            key=key,
            provider="ollama",
            name=m.name,
            label=dropdown_label(m),
            hint=hint_for(m) + (" · capabilities: " + " · ".join(m.capabilities or ["completion"])),
            is_vision=m.is_vision,
            context_length=m.context_length,
        )
    for provider in providers.configured_providers():
        for am in cached_provider_models(provider):
            catalog[am.key] = SelectedModel(
                key=am.key,
                provider=provider,
                name=am.id,
                label=am.dropdown_label,
                hint=am.hint + " · cloud API",
                is_vision=am.is_vision,
                context_length=am.context_length,
            )
    return catalog


def get_state(key: str, default=None):
    if key not in st.session_state:
        st.session_state[key] = default
    return st.session_state[key]


def switch_conversation(conv_id: str | None, catalog: dict[str, SelectedModel]) -> None:
    """Change active conversation, extracting memories from the one we leave."""
    prev = st.session_state.get("conv_id")
    if prev and st.session_state.get("settings_memory", config.memory_enabled):
        _maybe_extract_memories(prev, force=True)
    st.session_state.conv_id = conv_id
    if conv_id:  # restore the model this conversation was using, if still available
        conv = chat_store.get_conversation(conv_id)
        if conv:
            key = normalize_model_key(conv["model"])
            if key in catalog:
                # Applied on the next run, before the selectbox is instantiated
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


def _autotitle(conv_id: str, first_user: str, first_assistant: str) -> None:
    helper = st.session_state.get("helper_model")
    if not helper:
        return
    try:
        title = generate(
            helper,
            f"User: {first_user[:400]}\nAssistant: {first_assistant[:400]}",
            system=(
                "Write a 3-6 word title for this conversation. "
                "Output ONLY the title, no quotes, no punctuation at the end."
            ),
        )
        title = title.strip().strip('"')[:60] or "New chat"
        chat_store.rename_conversation(conv_id, title)
    except Exception as exc:
        logger.warning("autotitle failed: {}", exc)


def _handle_attachments(files, selected: SelectedModel, models: list[ModelInfo], conv_id: str):
    """Process uploads. Returns (attachment_context, images_for_model, attachment_meta).

    images_for_model is a list of (bytes, mime) tuples.
    """
    context_parts: list[str] = []
    images: list[tuple[bytes, str]] = []
    meta: list[dict] = []
    embed = st.session_state.get("embed_model")

    for f in files:
        att = parse_upload(f.name, f.getvalue())
        meta.append({"name": att.name, "kind": att.kind})
        if att.kind == "image":
            if selected.is_vision:
                images.append((att.image_bytes, att.mime))
            else:
                fallback = vision_fallback_model(models)
                if fallback:
                    st.info(
                        f"`{selected.name}` can't see images — extracting content "
                        f"with local `{fallback.name}` instead."
                    )
                    with st.spinner(f"Reading {att.name} with {fallback.name}..."):
                        desc = describe_image(fallback.name, att.image_bytes)
                    context_parts.append(
                        f"## Image uploaded by user: {att.name}\n"
                        f"(extracted by a vision model)\n{desc}"
                    )
                else:
                    st.warning(f"No vision-capable model available to read {att.name}.")
        else:  # document
            if not att.text.strip():
                st.warning(
                    f"Could not extract text from {att.name}."
                    + (" Install `antiword` or LibreOffice for .doc support." if att.name.endswith(".doc") else "")
                )
                continue
            if len(att.text) <= config.doc_context_budget_chars:
                context_parts.append(f"## Uploaded document: {att.name}\n{att.text}")
            elif embed:
                chunks = chunk_text(att.text, config.chunk_chars, config.chunk_overlap_chars)
                with st.spinner(f"Indexing {att.name} ({len(chunks)} chunks)..."):
                    rag.index_doc_chunks(embed, conv_id, att.name, chunks)
                st.info(f"`{att.name}` is large — indexed for retrieval; ask away.")
            else:
                context_parts.append(
                    f"## Uploaded document: {att.name} (truncated)\n"
                    f"{att.text[: config.doc_context_budget_chars]}"
                )
                st.warning("No embedding model found — large file truncated to fit context.")
    return "\n\n".join(context_parts), images, meta


def _feedback_widget(message_id: str, current: dict[str, int]) -> None:
    key = f"fb_{message_id}"
    existing = current.get(message_id)
    score = st.feedback("thumbs", key=key)
    if score is not None:
        rating = 1 if score == 1 else -1
        if rating != existing:
            chat_store.set_feedback(message_id, rating)


def _stream_for(selected: SelectedModel, messages, temperature: float):
    """Route streaming to Ollama or the selected cloud provider."""
    if selected.provider == "ollama":
        # Ollama wants raw image bytes, not (bytes, mime) tuples
        for m in messages:
            if m.get("images"):
                m["images"] = [img for img, _mime in m["images"]]
        return stream_chat(selected.name, messages, temperature=temperature)
    return providers.stream_chat(selected.provider, selected.name, messages, temperature)


# --- sidebar -------------------------------------------------------------------

if not ollama_alive():
    st.error(
        f"Cannot reach Ollama at `{config.ollama_host}`. "
        "Start it with `ollama serve` and reload."
    )
    st.stop()

models = cached_models()
show_cloud = get_state("settings_show_cloud", config.show_cloud_models)
catalog = build_model_catalog(models, show_cloud)
embed_info = embedding_model(models)
st.session_state.embed_model = embed_info.name if embed_info else None
helper_info = smallest_text_model(models)
st.session_state.helper_model = helper_info.name if helper_info else None

pending_model = st.session_state.pop("pending_model", None)
if pending_model and pending_model in catalog:
    st.session_state.selected_model = pending_model

with st.sidebar:
    st.title("🤖 Chat Studio")

    col1, col2 = st.columns([4, 1])
    with col1:
        selected_key = st.selectbox(
            "Model",
            options=list(catalog.keys()),
            format_func=lambda k: catalog[k].label,
            key="selected_model",
        )
    with col2:
        st.write("")
        if st.button("⟳", help="Refresh model lists (Ollama + providers)"):
            cached_models.clear()
            cached_provider_models.clear()
            st.rerun()

    selected = catalog[selected_key]
    st.caption(f"**{selected.hint}**")
    if not embed_info:
        st.caption("⚠️ No embedding model — memory & RAG off. `ollama pull embeddinggemma`")
    if not providers.configured_providers():
        st.caption("💡 Add OpenAI/Anthropic/... API keys on the **Providers** page.")

    if st.button("➕ New chat", use_container_width=True, type="primary"):
        switch_conversation(None, catalog)
        st.rerun()

    st.divider()
    st.caption("Conversations")
    for conv in chat_store.list_conversations(limit=50):
        c1, c2 = st.columns([5, 1])
        active = st.session_state.get("conv_id") == conv["id"]
        with c1:
            if st.button(
                ("● " if active else "") + conv["title"],
                key=f"conv_{conv['id']}",
                use_container_width=True,
            ):
                switch_conversation(conv["id"], catalog)
                st.rerun()
        with c2:
            if st.button("🗑", key=f"del_{conv['id']}", help="Delete"):
                chat_store.delete_conversation(conv["id"])
                rag.delete_conv_vectors(conv["id"])
                if active:
                    st.session_state.conv_id = None
                st.rerun()


# --- main chat area ---------------------------------------------------------------

conv_id = st.session_state.get("conv_id")
history_msgs = chat_store.get_messages(conv_id) if conv_id else []
feedback_map = chat_store.get_feedback(conv_id) if conv_id else {}

if not history_msgs:
    st.markdown(
        f"### Chat with `{selected.name}`\n"
        f"*{selected.hint}* — upload files or images right in the message box."
    )

for m in history_msgs:
    with st.chat_message(m["role"]):
        files_meta = [a for a in m["attachments"] if a.get("kind") != "reference"]
        refs_meta = [a for a in m["attachments"] if a.get("kind") == "reference"]
        if files_meta:
            st.caption("📎 " + ", ".join(a["name"] for a in files_meta))
        if refs_meta:
            st.caption("🔗 referencing: " + " · ".join(f"_{a['name']}_" for a in refs_meta))
        st.markdown(m["content"])
        if m["role"] == "assistant":
            _feedback_widget(m["id"], feedback_map)

prompt = st.chat_input(
    f"Message {selected.name}...",
    accept_file="multiple",
    file_type=ACCEPTED_TYPES,
)

if prompt:
    user_text = prompt.text or ""
    files = prompt.files or []
    if not user_text and files:
        user_text = "Please look at the attached file(s)."

    if conv_id is None:
        conv_id = chat_store.create_conversation(selected.key)
        st.session_state.conv_id = conv_id

    attachment_context, images, att_meta = _handle_attachments(
        files, selected, models, conv_id
    )

    chat_store.add_message(conv_id, "user", user_text, att_meta or None)
    with st.chat_message("user"):
        if att_meta:
            st.caption("📎 " + ", ".join(a["name"] for a in att_meta))
        st.markdown(user_text)

    memory_on = get_state("settings_memory", config.memory_enabled)
    crosschat_on = get_state("settings_crosschat", config.cross_chat_references)
    messages, references = build_messages(
        conv_id=conv_id,
        user_text=user_text,
        embed_model=st.session_state.embed_model,
        history=[{"role": m["role"], "content": m["content"]} for m in history_msgs],
        attachment_context=attachment_context,
        custom_system=get_state("settings_system_prompt", ""),
        memory_enabled=memory_on,
        cross_chat_enabled=crosschat_on,
    )
    current_turn = {"role": "user", "content": user_text}
    if images:
        current_turn["images"] = images
    messages.append(current_turn)

    with st.chat_message("assistant"):
        if references:
            st.caption("🔗 referencing: " + " · ".join(f"_{r}_" for r in references))
        try:
            answer = st.write_stream(
                _stream_for(
                    selected,
                    messages,
                    temperature=get_state("settings_temperature", config.temperature),
                )
            )
        except Exception as exc:
            st.error(f"Generation failed: {exc}")
            st.stop()

    ref_meta = [{"name": r, "kind": "reference"} for r in references]
    chat_store.add_message(conv_id, "assistant", str(answer), ref_meta or None)

    if len(history_msgs) == 0:  # title first so indexed turns carry the real title
        _autotitle(conv_id, user_text, str(answer))
    after_turn_indexing(conv_id, st.session_state.embed_model, user_text, str(answer))

    if memory_on:
        _maybe_extract_memories(conv_id)
    st.rerun()
