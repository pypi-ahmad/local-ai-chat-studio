"""Rolling user profile: learns style and preferences from chats + feedback."""

from __future__ import annotations

from loguru import logger

from src import chat_store
from src.config import config
from src.ollama_client import generate

PROFILE_KEY = "user_profile"
PROFILE_COUNTER_KEY = "convs_since_profile"

_PROFILE_SYSTEM = (
    "You maintain a concise USER PROFILE for a personal AI assistant, so future "
    "answers fit this user. Given the previous profile, recent conversation "
    "snippets, and feedback (+1 liked / -1 disliked answers), write the updated "
    "profile: 4-10 bullet points covering expertise level, domains of interest, "
    "preferred answer style (length, code vs prose, tone), and standing context. "
    "Keep only what is well-supported. Output ONLY the bullet list, no preamble."
)


def get_profile() -> str:
    return chat_store.kv_get(PROFILE_KEY, "") or ""


def note_conversation_done() -> bool:
    """Bump the counter; return True when a profile refresh is due."""
    count = int(chat_store.kv_get(PROFILE_COUNTER_KEY, "0") or 0) + 1
    if count >= config.profile_refresh_every:
        chat_store.kv_set(PROFILE_COUNTER_KEY, "0")
        return True
    chat_store.kv_set(PROFILE_COUNTER_KEY, str(count))
    return False


def rebuild_profile(helper_model: str) -> str:
    """Regenerate the user profile from recent chats and feedback."""
    convs = chat_store.list_conversations(limit=config.profile_refresh_every * 2)
    snippets: list[str] = []
    for conv in convs:
        for m in chat_store.get_messages(conv["id"]):
            if m["role"] == "user":
                snippets.append(m["content"][:400])
            if len(snippets) >= 40:
                break
        if len(snippets) >= 40:
            break
    feedback = chat_store.recent_feedback_samples(limit=20)
    fb_text = "\n".join(f"[{f['rating']:+d}] {f['content'][:300]}" for f in feedback) or "(none)"
    prev = get_profile() or "(none yet)"

    prompt = (
        f"PREVIOUS PROFILE:\n{prev}\n\n"
        f"RECENT USER MESSAGES:\n" + "\n".join(f"- {s}" for s in snippets) + "\n\n"
        f"RATED ASSISTANT ANSWERS:\n{fb_text}"
    )
    try:
        profile = generate(helper_model, prompt, system=_PROFILE_SYSTEM)
        chat_store.kv_set(PROFILE_KEY, profile)
        logger.info("User profile rebuilt ({} chars)", len(profile))
        return profile
    except Exception as exc:
        logger.warning("profile rebuild failed: {}", exc)
        return prev
