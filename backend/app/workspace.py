from __future__ import annotations

import hashlib
import json
import math
import re

from backend.app.contracts import (
    ChatMessage,
    ContextPlan,
    ContextSection,
    ContextSource,
    SafetyFinding,
    TurnPreflight,
)
from backend.app.store import Store


SECRET_PATTERNS = (
    re.compile(r"\b(?:sk|sk-ant)-[A-Za-z0-9_-]{12,}\b", re.IGNORECASE),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
)
PII_PATTERNS = (
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    re.compile(r"(?<!\d)(?:\+?\d[\d .()-]{8,}\d)(?!\d)"),
)
INJECTION_PATTERNS = (
    re.compile(r"\bignore (?:all |any )?(?:previous|prior|system) instructions?\b", re.IGNORECASE),
    re.compile(r"\b(?:reveal|print|return) (?:the )?(?:system prompt|secret|api key)\b", re.IGNORECASE),
    re.compile(r"\bact as (?:the )?system\b", re.IGNORECASE),
)


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / 4)


def scan_text(text: str) -> list[SafetyFinding]:
    findings: list[SafetyFinding] = []
    occupied: list[tuple[int, int]] = []
    for category, severity, patterns in (
        ("secret", "high", SECRET_PATTERNS),
        ("pii", "medium", PII_PATTERNS),
        ("prompt_injection", "high", INJECTION_PATTERNS),
    ):
        for pattern in patterns:
            for match in pattern.finditer(text):
                span = match.span()
                if any(span[0] < end and span[1] > start for start, end in occupied):
                    continue
                occupied.append(span)
                finding_id = hashlib.sha256(
                    f"{category}:{match.start()}:{match.group(0)}".encode()
                ).hexdigest()[:12]
                findings.append(
                    SafetyFinding(
                        id=finding_id,
                        category=category,
                        severity=severity,
                        preview=_redact(match.group(0)),
                        message={
                            "secret": "Possible credential detected",
                            "pii": "Possible personal information detected",
                            "prompt_injection": "Possible instruction override detected",
                        }[category],
                    )
                )
    return findings


def build_context_plan(
    store: Store, conversation_id: str, payload: TurnPreflight
) -> ContextPlan:
    conversation = store.get_conversation(conversation_id)
    local = payload.provider in {"echo", "ollama", "omniroute"}
    policy = store.get_policy(payload.provider)
    history_allowed = local or policy.allow_retrieval
    memory_allowed = payload.include_memory and (local or policy.allow_memory)
    retrieval_allowed = payload.include_retrieval and (local or policy.allow_retrieval)
    attachment_allowed = payload.include_attachments and (local or policy.allow_attachments)
    web_allowed = payload.include_web and (local or policy.allow_web)
    backpack_allowed = payload.include_backpack and (local or policy.allow_backpacks)

    history_text = "\n".join(item.content for item in conversation.messages[-20:])
    memories = [item for item in store.list_memories() if item.status == "active"] if memory_allowed else []
    uploads = store.upload_texts(conversation_id) if attachment_allowed else []
    memory_text = "\n".join(item.content for item in memories)
    upload_text = "\n".join(content for _, _, content in uploads)
    sections = [
        ContextSection(kind="system", estimated_tokens=24),
        ContextSection(
            kind="history",
            estimated_tokens=estimate_tokens(history_text),
            included=history_allowed,
            reason=None if history_allowed else "Provider policy defaults to prompt only",
        ),
        ContextSection(
            kind="memory",
            estimated_tokens=estimate_tokens(memory_text),
            included=memory_allowed,
            reason=None if memory_allowed else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="retrieval",
            included=retrieval_allowed,
            reason=None if retrieval_allowed else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="attachments",
            estimated_tokens=estimate_tokens(upload_text),
            included=attachment_allowed,
            reason=None if attachment_allowed else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="web",
            included=web_allowed,
            reason=None if web_allowed else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="backpack",
            included=backpack_allowed,
            reason=None if backpack_allowed else "Disabled by provider policy or run settings",
        ),
        ContextSection(kind="user", estimated_tokens=estimate_tokens(payload.content)),
    ]
    sources: list[ContextSource] = []
    if history_allowed:
        sources.extend(
            ContextSource(
                id=item.id,
                kind="history",
                title=f"{item.role.title()} message",
                preview=item.content[:160],
                estimated_tokens=estimate_tokens(item.content),
            )
            for item in conversation.messages[-20:]
        )
    sources.extend(
        ContextSource(
            id=item.id,
            kind="memory",
            title=item.category.title(),
            preview=item.content[:160],
            estimated_tokens=estimate_tokens(item.content),
        )
        for item in memories
    )
    sources.extend(
        ContextSource(
            id=upload_id,
            kind="attachment",
            title=filename,
            preview=content[:160],
            estimated_tokens=estimate_tokens(content),
        )
        for upload_id, filename, content in uploads
    )
    if payload.backpack_id and backpack_allowed:
        backpack = store.get_backpack(payload.backpack_id)
        for item in backpack.items:
            sources.append(
                ContextSource(
                    id=item.id,
                    kind="backpack",
                    title=item.title,
                    preview=item.content[:160],
                    estimated_tokens=estimate_tokens(item.content),
                )
            )
    findings = scan_text(payload.content)
    for source in sources:
        source_findings = [
            item for item in scan_text(source.preview) if item.category == "prompt_injection"
        ]
        if source_findings:
            source.trust = "suspicious"
            source.included = False
            for item in source_findings:
                item.id = hashlib.sha256(f"{source.id}:{item.id}".encode()).hexdigest()[:12]
            findings.extend(source_findings)
    estimated = sum(section.estimated_tokens for section in sections if section.included)
    budget = max(1, int(payload.context_limit * 0.8))
    plan_basis = {
        "conversation_id": conversation_id,
        "request": payload.model_dump(),
        "sections": [section.model_dump() for section in sections],
        "sources": [source.model_dump() for source in sources],
        "findings": [finding.id for finding in findings],
    }
    plan_hash = hashlib.sha256(
        json.dumps(plan_basis, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return ContextPlan(
        plan_hash=plan_hash,
        estimated_tokens=estimated,
        budget_tokens=budget,
        sections=sections,
        sources=sources,
        findings=findings,
        requires_confirmation=bool(findings),
    )


def assemble_messages(
    store: Store,
    conversation_id: str,
    payload: TurnPreflight,
    plan: ContextPlan,
    excluded_source_ids: set[str] | None = None,
) -> list[ChatMessage]:
    excluded = excluded_source_ids or set()
    included = {section.kind: section.included for section in plan.sections}
    messages: list[ChatMessage] = []
    system_parts = ["You are a helpful personal AI assistant. Be direct and accurate."]
    focus = store.active_focus(conversation_id)
    if focus:
        system_parts.append(
            "Focus objective: "
            f"{focus.objective}\nSuccess criteria: {focus.success_criteria}\n"
            f"Constraints: {', '.join(focus.constraints) or 'None'}"
        )
    if payload.backpack_id and included.get("backpack"):
        backpack = store.get_backpack(payload.backpack_id)
        items = [item for item in backpack.items if item.id not in excluded]
        if items:
            system_parts.append(
                "Context backpack:\n" + "\n".join(f"- {item.title}: {item.content}" for item in items)
            )
    if included.get("memory"):
        memories = [
            item for item in store.list_memories() if item.status == "active" and item.id not in excluded
        ]
        if memories:
            system_parts.append(
                "Long-term memory:\n"
                + "\n".join(f"- [{item.category}] {item.content}" for item in memories)
            )
    if included.get("attachments"):
        uploads = [item for item in store.upload_texts(conversation_id) if item[0] not in excluded]
        if uploads:
            system_parts.append(
                "Uploaded documents:\n"
                + "\n\n".join(f"[{filename}]\n{content}" for _, filename, content in uploads)
            )
    messages.append(ChatMessage(role="system", content="\n\n".join(system_parts)))
    if included.get("history"):
        conversation = store.get_conversation(conversation_id)
        messages.extend(
            ChatMessage(role=item.role, content=item.content)
            for item in conversation.messages[-20:]
            if item.id not in excluded and item.role in {"user", "assistant"}
        )
    messages.append(ChatMessage(role="user", content=payload.content))
    return messages


def _redact(value: str) -> str:
    if len(value) <= 8:
        return "••••"
    return f"{value[:3]}…{value[-4:]}"
