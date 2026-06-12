"""Background generation jobs.

A chat reply runs in a daemon thread instead of blocking the Streamlit script,
so the user can start another chat, open Settings, or browse while the answer
keeps streaming. Progress is written to a process-global registry that the UI
polls; the finished message is persisted to SQLite by the worker itself, so it
survives even if the user never looks back at that conversation.

Workers must never call ``st.*`` — Streamlit APIs only work on the main script
thread. They touch SQLite / ChromaDB / Ollama directly.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Iterator

from loguru import logger

from src import chat_store, memory, providers, rag
from src.ollama_client import generate as ollama_generate
from src.ollama_client import stream_chat as ollama_stream
from src.orchestrator import after_turn_indexing
from src.personalization import note_conversation_done, rebuild_profile

MEMORY_EXTRACT_EVERY = 8  # keep in sync with app.py


@dataclass
class Job:
    """In-flight (or just-finished) generation for one conversation."""

    conv_id: str
    model_name: str
    status: str = "running"  # running | done | error
    text: str = ""
    error: str = ""
    references: list[str] = field(default_factory=list)


_jobs: dict[str, Job] = {}
_lock = threading.Lock()


def get(conv_id: str | None) -> Job | None:
    if not conv_id:
        return None
    with _lock:
        return _jobs.get(conv_id)


def is_running(conv_id: str | None) -> bool:
    job = get(conv_id)
    return bool(job and job.status == "running")


def running_conversations() -> set[str]:
    with _lock:
        return {cid for cid, j in _jobs.items() if j.status == "running"}


def clear(conv_id: str) -> None:
    with _lock:
        _jobs.pop(conv_id, None)


def start(
    conv_id: str,
    provider: str,
    model_name: str,
    messages: list[dict[str, Any]],
    references: list[str],
    temperature: float,
    embed_model: str | None,
    helper_model: str | None,
    memory_on: bool,
    is_first_turn: bool,
    user_text: str,
) -> Job:
    """Spawn a background worker for one assistant reply and return its Job."""
    job = Job(conv_id=conv_id, model_name=model_name, references=references)
    with _lock:
        _jobs[conv_id] = job
    thread = threading.Thread(
        target=_run,
        args=(
            job, provider, model_name, messages, references, temperature,
            embed_model, helper_model, memory_on, is_first_turn, user_text,
        ),
        daemon=True,
    )
    thread.start()
    return job


def _stream(provider: str, model_name: str, messages: list[dict[str, Any]], temperature: float) -> Iterator[str]:
    if provider == "ollama":
        for m in messages:  # Ollama wants raw image bytes, not (bytes, mime) tuples
            if m.get("images"):
                m["images"] = [img for img, _mime in m["images"]]
        yield from ollama_stream(model_name, messages, temperature=temperature)
    else:
        yield from providers.stream_chat(provider, model_name, messages, temperature)


def _run(
    job: Job,
    provider: str,
    model_name: str,
    messages: list[dict[str, Any]],
    references: list[str],
    temperature: float,
    embed_model: str | None,
    helper_model: str | None,
    memory_on: bool,
    is_first_turn: bool,
    user_text: str,
) -> None:
    try:
        parts: list[str] = []
        for chunk in _stream(provider, model_name, messages, temperature):
            parts.append(chunk)
            with _lock:
                job.text = "".join(parts)
        answer = "".join(parts).strip()

        ref_meta = [{"name": r, "kind": "reference"} for r in references]
        chat_store.add_message(job.conv_id, "assistant", answer, ref_meta or None)

        if is_first_turn and helper_model:
            _autotitle(job.conv_id, user_text, answer, helper_model)
        if embed_model:
            after_turn_indexing(job.conv_id, embed_model, user_text, answer)
        if memory_on and helper_model and embed_model:
            _maybe_extract(job.conv_id, helper_model, embed_model)

        with _lock:
            job.status = "done"
    except Exception as exc:  # surfaced to the UI; never crashes the app
        logger.exception("generation job failed for {}", job.conv_id)
        with _lock:
            job.error = str(exc)
            job.status = "error"


def _autotitle(conv_id: str, first_user: str, first_assistant: str, helper_model: str) -> None:
    try:
        title = ollama_generate(
            helper_model,
            f"User: {first_user[:400]}\nAssistant: {first_assistant[:400]}",
            system=(
                "Write a 3-6 word title for this conversation. "
                "Output ONLY the title, no quotes, no punctuation at the end."
            ),
        )
        chat_store.rename_conversation(conv_id, title.strip().strip('"')[:60] or "New chat")
    except Exception as exc:
        logger.warning("autotitle failed: {}", exc)


def _maybe_extract(conv_id: str, helper_model: str, embed_model: str) -> None:
    conv = chat_store.get_conversation(conv_id)
    if not conv:
        return
    n = chat_store.message_count(conv_id)
    if n == 0 or n % MEMORY_EXTRACT_EVERY != 0:
        return
    already = conv["memory_extracted_at"] and conv["memory_extracted_at"] >= conv["updated_at"]
    if already:
        return
    memory.extract_memories(conv_id, helper_model, embed_model)
    if note_conversation_done():
        rebuild_profile(helper_model)
