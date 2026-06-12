"""Assemble the per-turn message list: system prompt + retrieved context + history."""

from __future__ import annotations

from typing import Any

from src import chat_store, memory, rag
from src.config import config

BASE_SYSTEM = (
    "You are a helpful personal AI assistant running fully locally on the user's "
    "machine. Be direct and accurate. When context from documents or previous "
    "conversations is provided, use it and mention the source naturally."
)


def build_messages(
    conv_id: str,
    user_text: str,
    embed_model: str | None,
    history: list[dict[str, Any]],
    attachment_context: str = "",
    custom_system: str = "",
    memory_enabled: bool = True,
    cross_chat_enabled: bool = True,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Build the Ollama message list for this turn.

    Returns (messages, reference_titles) where reference_titles names the past
    conversations that contributed context (for UI display).
    """
    from src.personalization import get_profile

    sections: list[str] = [custom_system.strip() or BASE_SYSTEM]
    references: list[str] = []

    profile = get_profile()
    if profile and memory_enabled:
        sections.append(f"## What you know about the user\n{profile}")

    if embed_model and memory_enabled:
        mems = memory.relevant_memories(user_text, embed_model)
        if mems:
            bullet = "\n".join(f"- [{m['category']}] {m['content']}" for m in mems)
            sections.append(f"## Long-term memory\n{bullet}")

    if embed_model and cross_chat_enabled:
        hits = rag.search_history(
            embed_model,
            exclude_conv=conv_id,
            query=user_text,
            top_k=config.cross_chat_top_k,
            min_similarity=config.cross_chat_min_similarity,
        )
        if hits:
            # Resolve titles from SQLite — vector metadata may predate auto-titling/renames
            for h in hits:
                conv = chat_store.get_conversation(h.get("conv_id", ""))
                if conv:
                    h["title"] = conv["title"]
            ctx = "\n".join(f"- (from \"{h['title']}\") {h['text'][:500]}" for h in hits)
            sections.append(f"## Context from the user's previous conversations\n{ctx}")
            references = sorted({h["title"] for h in hits})

    if embed_model and rag.conv_has_docs(conv_id):
        doc_hits = rag.search_docs(embed_model, conv_id, user_text, top_k=config.rag_top_k)
        if doc_hits:
            ctx = "\n\n".join(f"[{h['doc']}]\n{h['text']}" for h in doc_hits)
            sections.append(f"## Relevant excerpts from uploaded documents\n{ctx}")

    if attachment_context:
        sections.append(attachment_context)

    messages: list[dict[str, Any]] = [{"role": "system", "content": "\n\n".join(sections)}]
    for m in history[-20:]:  # cap rolling window to protect small contexts
        msg: dict[str, Any] = {"role": m["role"], "content": m["content"]}
        if m.get("images"):
            msg["images"] = m["images"]
        messages.append(msg)
    return messages, references


def after_turn_indexing(
    conv_id: str, embed_model: str | None, user_text: str, assistant_text: str
) -> None:
    """Embed the new turn into the cross-chat history index."""
    if not embed_model:
        return
    conv = chat_store.get_conversation(conv_id)
    title = conv["title"] if conv else "Untitled"
    rag.index_history_turn(embed_model, conv_id, title, "user", user_text)
    rag.index_history_turn(embed_model, conv_id, title, "assistant", assistant_text)
