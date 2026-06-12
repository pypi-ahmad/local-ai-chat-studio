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
import time
from dataclasses import dataclass, field
from typing import Any, Iterator

from loguru import logger

from src import chat_store, memory, providers, rag
from src.config import config
from src.files import Attachment, chunk_text, parse_upload
from src.ollama_client import describe_image
from src.ollama_client import generate as ollama_generate
from src.ollama_client import stream_chat as ollama_stream
from src.orchestrator import after_turn_indexing, build_messages
from src.personalization import note_conversation_done, rebuild_profile

MEMORY_EXTRACT_EVERY = 8  # keep in sync with app.py


@dataclass
class Job:
    """In-flight (or just-finished) generation for one conversation."""

    conv_id: str
    model_name: str
    status: str = "running"  # running | done | error | cancelled
    phase: str = "preparing"  # preparing (files/context) | generating
    text: str = ""
    error: str = ""
    references: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)  # e.g. "image read by OCR model"
    cancelled: bool = False
    start_ts: float = field(default_factory=time.monotonic)

    def elapsed(self) -> float:
        return time.monotonic() - self.start_ts


_jobs: dict[str, Job] = {}
_lock = threading.Lock()


def stop(conv_id: str) -> None:
    """Request cancellation. The UI stops showing the job immediately; the worker
    discards its result (does not persist) once the in-flight request unblocks."""
    with _lock:
        job = _jobs.get(conv_id)
        if job and job.status == "running":
            job.cancelled = True
            job.status = "cancelled"


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
    is_vision: bool,
    user_text: str,
    raw_files: list[tuple[str, bytes]],
    history: list[dict[str, Any]],
    custom_system: str,
    temperature: float,
    embed_model: str | None,
    helper_model: str | None,
    vision_fallback: str | None,
    memory_on: bool,
    crosschat_on: bool,
    is_first_turn: bool,
) -> Job:
    """Spawn a background worker for one assistant reply and return its Job.

    Takes raw inputs (text, uploaded file bytes, history) — ALL slow work
    (file parsing/OCR, document indexing, memory & cross-chat retrieval, prompt
    assembly, generation) happens in the worker so the UI rerenders instantly.
    """
    job = Job(conv_id=conv_id, model_name=model_name)
    with _lock:
        _jobs[conv_id] = job
    thread = threading.Thread(
        target=_run,
        args=(
            job, provider, model_name, is_vision, user_text, raw_files, history,
            custom_system, temperature, embed_model, helper_model,
            vision_fallback, memory_on, crosschat_on, is_first_turn,
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


def _process_attachments(
    job: Job,
    raw_files: list[tuple[str, bytes]],
    is_vision: bool,
    vision_fallback: str | None,
    embed_model: str | None,
) -> tuple[str, list[tuple[bytes, str]]]:
    """Parse uploads into context text + images for the model (worker-side)."""
    context_parts: list[str] = []
    images: list[tuple[bytes, str]] = []
    for name, raw in raw_files:
        att: Attachment = parse_upload(name, raw)
        if att.kind == "image":
            if is_vision:
                images.append((att.image_bytes, att.mime))
            elif vision_fallback:
                job.notes.append(f"reading {att.name} with {vision_fallback} (model can't see images)")
                desc = describe_image(vision_fallback, att.image_bytes)
                context_parts.append(
                    f"## Image uploaded by user: {att.name}\n(extracted by a vision model)\n{desc}"
                )
            else:
                context_parts.append(f"## Image uploaded by user: {att.name}\n(no vision model available to read it)")
        else:  # document
            if not att.text.strip():
                context_parts.append(f"## Uploaded document: {att.name}\n(no text could be extracted)")
                continue
            if len(att.text) <= config.doc_context_budget_chars:
                context_parts.append(f"## Uploaded document: {att.name}\n{att.text}")
            elif embed_model:
                job.notes.append(f"indexing {att.name} for retrieval (large file)")
                chunks = chunk_text(att.text, config.chunk_chars, config.chunk_overlap_chars)
                rag.index_doc_chunks(embed_model, job.conv_id, att.name, chunks)
            else:
                context_parts.append(
                    f"## Uploaded document: {att.name} (truncated)\n"
                    f"{att.text[: config.doc_context_budget_chars]}"
                )
    return "\n\n".join(context_parts), images


def _run(
    job: Job,
    provider: str,
    model_name: str,
    is_vision: bool,
    user_text: str,
    raw_files: list[tuple[str, bytes]],
    history: list[dict[str, Any]],
    custom_system: str,
    temperature: float,
    embed_model: str | None,
    helper_model: str | None,
    vision_fallback: str | None,
    memory_on: bool,
    crosschat_on: bool,
    is_first_turn: bool,
) -> None:
    try:
        # Phase 1: prepare — file parsing/OCR/indexing + retrieval + prompt assembly.
        attachment_context, images = _process_attachments(
            job, raw_files, is_vision, vision_fallback, embed_model
        )
        if job.cancelled:
            return
        messages, references = build_messages(
            conv_id=job.conv_id,
            user_text=user_text,
            embed_model=embed_model,
            history=history,
            attachment_context=attachment_context,
            custom_system=custom_system,
            memory_enabled=memory_on,
            cross_chat_enabled=crosschat_on,
        )
        current_turn: dict[str, Any] = {"role": "user", "content": user_text}
        if images:
            current_turn["images"] = images
        messages.append(current_turn)
        with _lock:
            job.references = references
            job.phase = "generating"
        if job.cancelled:
            return

        # Phase 2: generate.
        parts: list[str] = []
        for chunk in _stream(provider, model_name, messages, temperature):
            if job.cancelled:
                logger.info("generation cancelled for {}", job.conv_id)
                return  # discard partial output; do not persist
            parts.append(chunk)
            with _lock:
                job.text = "".join(parts)
        if job.cancelled:
            return
        answer = "".join(parts).strip()

        ref_meta = [{"name": r, "kind": "reference"} for r in references]
        chat_store.add_message(job.conv_id, "assistant", answer, ref_meta or None)

        # Mark done now so the UI settles to the final message immediately; the
        # title/indexing/memory steps below are background polish, not blocking.
        with _lock:
            job.status = "done"
    except Exception as exc:  # surfaced to the UI; never crashes the app
        if job.cancelled:
            return  # request was cancelled; the error is just the aborted connection
        logger.exception("generation job failed for {}", job.conv_id)
        msg = _friendly_error(str(exc))
        # Persist the error as a visible assistant turn so the reason stays on
        # screen (it's marked so it's shown in red and excluded from model context).
        try:
            chat_store.add_message(job.conv_id, "assistant", msg, [{"kind": "error", "name": "error"}])
        except Exception:
            logger.exception("failed to persist error message for {}", job.conv_id)
        with _lock:
            job.error = msg
            job.status = "error"
        return

    try:  # best-effort post-processing — failures here never affect the reply
        if is_first_turn and helper_model:
            _autotitle(job.conv_id, user_text, answer, helper_model)
        if embed_model:
            after_turn_indexing(job.conv_id, embed_model, user_text, answer)
        if memory_on and helper_model and embed_model:
            _maybe_extract(job.conv_id, helper_model, embed_model)
    except Exception:
        logger.exception("post-processing failed for {}", job.conv_id)


def _friendly_error(raw: str) -> str:
    """Turn a raw exception string into a clear, actionable chat message."""
    low = raw.lower()
    if "requires a subscription" in low or "upgrade for access" in low:
        return ("⚠️ This Ollama Cloud model needs a paid subscription, so it can't run "
                "on the free tier. Pick a free `:cloud` model (e.g. `gemma4:31b-cloud`) or a "
                "local model. Details: " + raw)
    if "timed out" in low or "timeout" in low:
        return ("⚠️ The model didn't respond in time. It may be loading or the endpoint is "
                "busy/unreachable — try again, pick a smaller model, or check the endpoint. "
                "Details: " + raw)
    if "connection" in low or "refused" in low or "max retries" in low:
        return ("⚠️ Couldn't reach the model endpoint. If this is a remote/cloud Ollama, check "
                "the host and API key on the Providers page. Details: " + raw)
    return f"⚠️ Generation failed: {raw}"


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
