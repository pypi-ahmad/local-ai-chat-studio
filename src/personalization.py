"""Rolling user profile: learns style and preferences from chats + feedback.

Must not decide when a turn injects the profile into the prompt — that's
orchestrator.py's job (``get_profile`` is read-only from its perspective).
The profile itself is stored as plain text under a fixed key in
chat_store.py's generic ``kv`` table, not in its own table.

jobs.py is the only caller of ``rebuild_profile``/``note_conversation_done``,
and is not itself imported by any live entry point (backend/app or
elsewhere) — this module appears to be leftover from the Streamlit UI
removed in commit 240e80f ("feat: complete trusted workspace cutover").
"""

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
    """Bump the counter; return True when a profile refresh is due.

    Stored as a plain string under ``PROFILE_COUNTER_KEY`` in chat_store's
    ``kv`` table (parsed back to int here, not kept as one on disk).

    This is a read-modify-write against SQLite with no lock or transaction
    around the read-then-write: two conversations finishing at nearly the
    same moment (jobs.py runs each in its own thread) can race and cause an
    under- or over-count toward ``profile_refresh_every``. Low-stakes since
    it only shifts *when* a rebuild triggers, not the data used to build it.
    """
    count = int(chat_store.kv_get(PROFILE_COUNTER_KEY, "0") or 0) + 1
    if count >= config.profile_refresh_every:
        chat_store.kv_set(PROFILE_COUNTER_KEY, "0")
        return True
    chat_store.kv_set(PROFILE_COUNTER_KEY, str(count))
    return False


def rebuild_profile(helper_model: str) -> str:
    """Regenerate the user profile from recent chats and feedback."""
    convs = chat_store.list_conversations(limit=config.profile_refresh_every * 2)
    # Capped at 40 user-message snippets (400 chars each) below: bounds the
    # prompt sent to helper_model, which is typically a small local model.
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
        # Failure is swallowed into a success-shaped return: the stale
        # previous profile comes back unchanged rather than raising, and
        # nothing in the return value tells the caller a rebuild was skipped.
        logger.warning("profile rebuild failed: {}", exc)
        return prev
