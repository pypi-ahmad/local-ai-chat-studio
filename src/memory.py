"""ChatGPT-style memory: extract durable facts from chats, retrieve per turn."""

from __future__ import annotations

import json
import re

from loguru import logger

from src import chat_store, rag
from src.config import config
from src.ollama_client import generate

_EXTRACT_SYSTEM = (
    "You extract facts about the USER from a conversation, for a personal "
    "assistant's long-term memory. Extract anything the user reveals about "
    "themselves: name, profession, skills, current projects, tools they use, "
    "preferences, goals, constraints. Do NOT extract the assistant's answers or "
    "one-off questions. Output STRICT JSON: a list of objects with keys "
    '"content" (one concise sentence starting with the user\'s name or "User") and '
    '"category" (one of: identity, preference, project, goal, context). '
    'Example output: [{"content": "User is a data analyst at a bank", "category": "identity"}] '
    "Output [] only if the user revealed nothing about themselves. JSON only, no prose."
)


def extract_memories(conv_id: str, helper_model: str, embed_model: str) -> int:
    """Run fact extraction over a conversation; dedup and store. Returns # added."""
    messages = chat_store.get_messages(conv_id)
    user_turns = [m["content"] for m in messages if m["role"] == "user"]
    if not user_turns:
        return 0
    transcript = "\n".join(
        f"{m['role'].upper()}: {m['content'][:800]}" for m in messages[-30:]
    )
    try:
        raw = generate(helper_model, f"Conversation:\n{transcript}", system=_EXTRACT_SYSTEM)
        facts = _parse_json_list(raw)
    except Exception as exc:
        logger.warning("memory extraction failed for {}: {}", conv_id, exc)
        return 0

    added = 0
    for fact in facts:
        content = str(fact.get("content", "")).strip()
        category = str(fact.get("category", "fact")).strip() or "fact"
        if not content or len(content) < 8:
            continue
        dup_id = rag.similar_memory(embed_model, content)
        if dup_id:
            chat_store.touch_memories([dup_id])
            continue
        mem_id = chat_store.add_memory(content, category, conv_id)
        rag.index_memory(embed_model, mem_id, content)
        added += 1
    chat_store.mark_memory_extracted(conv_id)
    if added:
        logger.info("Added {} memories from conv {}", added, conv_id)
    return added


def relevant_memories(query: str, embed_model: str) -> list[dict]:
    """Pinned memories + semantically relevant ones, capped, usage-bumped."""
    all_active = {m["id"]: m for m in chat_store.list_memories(active_only=True)}
    if not all_active:
        return []
    chosen: dict[str, dict] = {m["id"]: m for m in all_active.values() if m["pinned"]}
    hits = rag.search_memories(embed_model, query, top_k=config.memory_max_injected)
    for h in hits:
        if h["id"] in all_active:
            chosen.setdefault(h["id"], all_active[h["id"]])
    result = list(chosen.values())[: config.memory_max_injected]
    chat_store.touch_memories([m["id"] for m in result])
    return result


def run_decay() -> int:
    return chat_store.decay_memories(config.memory_decay_days)


def _parse_json_list(raw: str) -> list[dict]:
    """Tolerant JSON-list parser for small-model output (strips fences/prose)."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
    for pattern in (r"\[.*\]", r"\{.*\}"):  # list preferred; bare object tolerated
        match = re.search(pattern, raw, flags=re.DOTALL)
        if not match:
            continue
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            data = [data]
        return [d for d in data if isinstance(d, dict)]
    return []
