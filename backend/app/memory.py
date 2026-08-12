from __future__ import annotations

import json
import re
from dataclasses import dataclass

from backend.app.contracts import ChatMessage, Conversation
from backend.app.providers import ProviderAdapter
from src.files import chunk_text


@dataclass
class ExtractionOutcome:
    candidates: list[dict]
    discarded: int


async def extract_memories(
    conversation: Conversation,
    adapter: ProviderAdapter,
    api_key: str | None,
    model: str,
    existing: list[str],
) -> ExtractionOutcome:
    transcript = "\n\n".join(
        f"[{message.id}] {message.role.upper()}: {message.content}"
        for message in conversation.messages
    )
    if not transcript.strip():
        return ExtractionOutcome([], 0)

    raw_candidates: list[dict] = []
    for chunk in chunk_text(transcript, 12_000, 0):
        response = await _complete(
            adapter,
            api_key,
            model,
            _selection_prompt(chunk),
        )
        raw_candidates.extend(_parse_memories(response))

    response = await _complete(
        adapter,
        api_key,
        model,
        _consolidation_prompt(raw_candidates, existing),
    )
    consolidated = _parse_memories(response)
    user_ids = {
        message.id for message in conversation.messages if message.role == "user"
    }
    seen = {re.sub(r"\W+", " ", content.lower()).strip() for content in existing}
    accepted: list[dict] = []
    discarded = 0
    for item in consolidated:
        content = str(item.get("content", "")).strip()
        source_ids = [
            str(message_id)
            for message_id in item.get("source_message_ids", [])
            if str(message_id) in user_ids
        ]
        disposition = item.get("disposition")
        normalized = re.sub(r"\W+", " ", content.lower()).strip()
        if (
            disposition not in {"active", "quarantined"}
            or not content
            or len(content) > 1000
            or not source_ids
            or not normalized
            or normalized in seen
        ):
            discarded += 1
            continue
        seen.add(normalized)
        status = "active" if disposition == "active" else "quarantined"
        reason = str(item.get("reason", "")).strip()[:500] or None
        accepted.append(
            {
                "content": content,
                "category": _category(str(item.get("category", "fact"))),
                "status": status,
                "quarantine_reason": reason if status == "quarantined" else None,
                "source_message_ids": source_ids,
                "selection_reason": reason,
            }
        )
    return ExtractionOutcome(accepted, discarded)


async def _complete(
    adapter: ProviderAdapter,
    api_key: str | None,
    model: str,
    prompt: str,
) -> str:
    stream = adapter.stream(
        api_key,
        model,
        [ChatMessage(role="user", content=prompt)],
        0,
    )
    parts: list[str] = []
    try:
        async for text in stream:
            parts.append(text)
    finally:
        await stream.aclose()
    return "".join(parts)


def _selection_prompt(transcript: str) -> str:
    return f"""You curate durable long-term memory for a personal AI assistant.
Read the transcript and return JSON only. Save only important, durable points explicitly grounded in USER messages: stable preferences, personal facts, goals, constraints, and project decisions. Never save secrets, credentials, raw file contents, assistant claims, guesses, temporary requests, or ordinary chat details.

Write each memory as one short, context-complete English statement in an LLM-friendly declarative style. Use this exact shape:
{{"memories":[{{"content":"...","category":"fact|preference|goal|constraint|decision|project","source_message_ids":["..."],"disposition":"active|quarantined|discard","reason":"..."}}]}}
Use quarantined only when the point may matter but is ambiguous or conflicting.

TRANSCRIPT:
{transcript}"""


def _consolidation_prompt(candidates: list[dict], existing: list[str]) -> str:
    return (
        """Consolidate proposed long-term memories. Return JSON only in the same shape.
Remove duplicates, transient details, secrets, assistant-derived claims, and anything already covered by EXISTING memories. Preserve source_message_ids. Keep one atomic statement per memory. Mark ambiguous items quarantined and rejected items discard.

EXISTING:
"""
        + json.dumps(existing, ensure_ascii=False)
        + "\n\nPROPOSED:\n"
        + json.dumps(candidates, ensure_ascii=False)
    )


def _parse_memories(text: str) -> list[dict]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Memory model returned invalid JSON")
    try:
        payload = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError("Memory model returned invalid JSON") from exc
    memories = payload.get("memories")
    if not isinstance(memories, list) or not all(
        isinstance(item, dict) for item in memories
    ):
        raise ValueError("Memory model returned an invalid memory list")
    return memories


def _category(value: str) -> str:
    return (
        value
        if value in {"fact", "preference", "goal", "constraint", "decision", "project"}
        else "fact"
    )
