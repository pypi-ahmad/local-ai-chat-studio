"""Context assembly and safety scanning: turns a turn's inputs into the chat messages sent to a provider, plus a previewable ContextPlan.

build_context_plan is the "preflight" step (estimate what will be included,
scan for safety findings, apply token-budget pruning) and assemble_messages
renders the approved sources into ChatMessage objects for a run — see
main.py's preflight_turn/create_turn for how the two connect via plan_hash.
Everything folded into the prompt here (history, memories, uploads, web
results, knowledge base materials) is potentially attacker-influenced content
the model will read as instructions, which is why scan_text/sanitize_text
exist — read those before changing what gets included by default.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re

from backend.app.contracts import (
    ChatMessage,
    ContextPlan,
    ContextSection,
    ContextSource,
    ImageInput,
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

# Character counts, not tokens or messages — used to truncate the
# older-history summary text itself (see _history_summary), separately from
# the token-budget pruning in build_context_plan.
RECENT_HISTORY_MESSAGES = 8
HISTORY_SUMMARY_ITEM_CHARS = 220
HISTORY_SUMMARY_MAX_CHARS = 3200


def _history_summary(messages) -> str:
    """Render older conversation messages as a compact bullet list, not a real LLM summary.

    Despite the name, this is mechanical truncation (head + ... + tail per
    message, capped total length), not anything summarized by a model — it
    exists so auto_compress_history can shrink old history without an extra
    provider call.
    """
    lines = []
    for item in messages:
        content = " ".join(item.content.split())
        if len(content) > HISTORY_SUMMARY_ITEM_CHARS:
            head = content[:150].rsplit(" ", 1)[0]
            tail = content[-55:].lstrip()
            content = f"{head} … {tail}"
        lines.append(f"- {item.role.title()}: {content}")
        if sum(len(line) + 1 for line in lines) >= HISTORY_SUMMARY_MAX_CHARS:
            break
    return "\n".join(lines)[:HISTORY_SUMMARY_MAX_CHARS]


def _history_parts(conversation, compress: bool):
    """Split conversation history into (older, recent, summary-of-older).

    When compress is False (or there isn't enough history to bother),
    "older" is always empty and only the most recent 20 messages are kept as
    "recent" — that 20 is an unconditional cap independent of
    RECENT_HISTORY_MESSAGES, which only applies once compression kicks in.
    """
    messages = [
        item for item in conversation.messages if item.role in {"user", "assistant"}
    ]
    if compress and len(messages) > RECENT_HISTORY_MESSAGES:
        older = messages[:-RECENT_HISTORY_MESSAGES]
        return older, messages[-RECENT_HISTORY_MESSAGES:], _history_summary(older)
    return [], messages[-20:], ""


def _history_summary_id(messages) -> str:
    # Deterministic id derived from the exact set/order of summarized message
    # ids, so the same older-history slice always produces the same
    # ContextSource id across preflight and the later create_turn call.
    basis = ":".join(item.id for item in messages)
    return f"history-summary-{hashlib.sha256(basis.encode()).hexdigest()[:16]}"
PII_PATTERNS = (
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    re.compile(r"(?<!\d)(?:\+?\d[\d .()-]{8,}\d)(?!\d)"),
)
INJECTION_PATTERNS = (
    re.compile(
        r"\bignore (?:all |any )?(?:previous|prior|system) instructions?\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:reveal|print|return) (?:the )?(?:system prompt|secret|api key)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bact as (?:the )?system\b", re.IGNORECASE),
)
logger = logging.getLogger(__name__)


def search_web(query: str, max_results: int = 5) -> list[dict[str, str]]:
    """Search the public web without credentials; provider failures yield no context."""
    try:
        from ddgs import DDGS

        results = DDGS().text(query, max_results=max_results) or []
        return [
            {
                "title": str(result.get("title", "")),
                "url": str(result.get("href", "")),
                "snippet": str(result.get("body", "")),
            }
            for result in results
            if result.get("href")
        ]
    except Exception as exc:
        logger.warning("Web search failed: %s", exc)
        return []


def retrieve_context(
    store: Store, conversation_id: str, query: str, top_k: int = 5
) -> list[dict[str, object]]:
    """Use the canonical Chroma index when configured, with a SQLite lexical fallback."""
    embed_model = os.getenv("CHAT_EMBED_MODEL")
    if embed_model:
        try:
            from src.rag import search_docs, search_history

            hits = search_docs(embed_model, conversation_id, query, top_k)
            hits.extend(
                search_history(embed_model, conversation_id, query, top_k, 0.35)
            )
            if hits:
                return hits[:top_k]
        except Exception as exc:
            logger.warning("Vector retrieval failed: %s", exc)
    return store.search_related_messages(query, conversation_id, top_k)


def relevant_memories(store: Store, query: str, top_k: int = 8):
    """Select up to top_k relevant active memories, with pinned ones always included.

    Falls back from vector search (when CHAT_EMBED_MODEL is set) to a simple
    term-overlap ranking, on either a missing embedding config or any vector
    search failure. Pinned memories are unconditionally prepended and are
    exempt from the top_k cap applied to the ranked set — the return value
    can exceed top_k if there are many pinned memories.
    """
    active = [item for item in store.list_memories() if item.status == "active"]
    pinned = [item for item in active if item.pinned]
    by_id = {item.id: item for item in active}
    ranked = []
    embed_model = os.getenv("CHAT_EMBED_MODEL")
    if embed_model:
        try:
            from src.rag import search_memories

            ranked = [
                by_id[hit["id"]]
                for hit in search_memories(embed_model, query, top_k)
                if hit.get("id") in by_id
            ]
        except Exception as exc:
            logger.warning("Memory retrieval failed: %s", exc)
    if not ranked:
        terms = set(re.findall(r"[a-z0-9]+", query.lower()))
        ranked = sorted(
            active,
            key=lambda item: len(
                terms & set(re.findall(r"[a-z0-9]+", item.content.lower()))
            ),
            reverse=True,
        )[:top_k]
    return pinned + [item for item in ranked if not item.pinned][:top_k]


def estimate_tokens(text: str) -> int:
    # Rough heuristic (~4 characters per token), not an actual tokenizer
    # call — good enough for budgeting/pruning decisions, not exact billing.
    return math.ceil(len(text) / 4)


def scan_text(text: str) -> list[SafetyFinding]:
    """Scan text for secrets, PII, and prompt-injection phrasing using fixed regex patterns.

    Categories are checked in priority order (secret, then pii, then
    prompt_injection) and matching spans are tracked in `occupied` so a later
    category's pattern can't re-flag text a higher-priority category already
    claimed — this only affects which category a given span is reported
    under, not whether it's flagged at all.
    """
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


def sanitize_text(text: str) -> str:
    # Unlike scan_text, this doesn't check INJECTION_PATTERNS — an injection
    # attempt is a phrase, not sensitive data to redact, so sanitize_text
    # (used for redacted run bundle exports) leaves it in place.
    sanitized = text
    for label, patterns in (("SECRET", SECRET_PATTERNS), ("PRIVATE", PII_PATTERNS)):
        for pattern in patterns:
            sanitized = pattern.sub(f"[REDACTED {label}]", sanitized)
    return sanitized


def build_context_plan(
    store: Store,
    conversation_id: str,
    payload: TurnPreflight,
    web_results: list[dict[str, str]] | None = None,
) -> ContextPlan:
    """Decide what context to include in a turn and compute a stable hash identifying that decision.

    Combines three kinds of gating for each context kind (history, memory,
    retrieval, attachments, web, backpack, knowledge): the payload's own
    include_* flags, the provider's ProviderPolicy (bypassed entirely for
    "local" providers, trusted not to leak context off-device), and — for
    knowledge-base sources specifically — whether that base itself allows
    retrieval. The resulting plan_hash covers the full sections/sources/
    findings, so main.create_turn can detect if anything relevant changed
    since a client's preflight call before actually spending a run on it.
    """
    conversation = store.get_conversation(conversation_id)
    knowledge_base = None
    knowledge_materials: list[dict[str, str]] = []
    if conversation.settings.knowledge_base_id:
        try:
            knowledge_base = store.get_knowledge_base(
                conversation.settings.knowledge_base_id
            )
            knowledge_materials = store.knowledge_base_materials(knowledge_base.id)
        except KeyError:
            knowledge_base = None
    # "local" providers are treated as running on the same machine (never
    # leaving it), so provider policy toggles are skipped for them entirely —
    # policy only restricts what's sent to a remote/cloud provider.
    local = payload.provider in {"echo", "ollama-local", "omniroute"}
    policy = store.get_policy(payload.provider)
    history_allowed = local or policy.allow_retrieval
    memory_allowed = payload.include_memory and (local or policy.allow_memory)
    retrieval_allowed = (
        payload.include_retrieval
        and (local or policy.allow_retrieval)
        and (knowledge_base is None or knowledge_base.include_retrieval)
    )
    attachment_allowed = payload.include_attachments and (
        local or policy.allow_attachments
    )
    web_allowed = payload.include_web and (local or policy.allow_web)
    backpack_allowed = payload.include_backpack and (local or policy.allow_backpacks)

    older_history, recent_history, history_summary = _history_parts(
        conversation, payload.auto_compress_history
    )
    history_text = "\n".join(
        [history_summary, *(item.content for item in recent_history)]
    ).strip()
    # Memories already pulled in via the bound knowledge base are excluded
    # from the separately-ranked "memory" section below, so the same memory
    # isn't sent twice (once as a memory source, once as a knowledge source).
    knowledge_memory_ids = {
        item["source_id"]
        for item in knowledge_materials
        if item["source_kind"] == "memory"
    }
    memories = (
        [
            item
            for item in relevant_memories(store, payload.content)
            if item.id not in knowledge_memory_ids
        ]
        if memory_allowed
        else []
    )
    selected_uploads = set(payload.attachment_ids)
    uploads = (
        [
            item
            for item in store.upload_texts(conversation_id)
            if item[0] in selected_uploads
        ]
        if attachment_allowed
        else []
    )
    upload_records = (
        [
            item
            for item in store.list_uploads(conversation_id)
            if item.id in selected_uploads
        ]
        if attachment_allowed
        else []
    )
    retrieval_hits = (
        retrieve_context(store, conversation_id, payload.content)
        if retrieval_allowed
        else []
    )
    memory_text = "\n".join(item.content for item in memories)
    upload_text = "\n".join(content for _, _, content in uploads)
    web_results = web_results or []
    web_text = "\n".join(item.get("snippet", "") for item in web_results)
    knowledge_allowed_by_kind = {
        "memory": memory_allowed,
        "upload": attachment_allowed,
        "backpack": backpack_allowed,
    }
    # Symmetric to the memory de-duplication above: an upload already
    # selected as an explicit attachment_id is excluded from the
    # knowledge-base token count/availability check, since it's counted under
    # "attachments" instead.
    knowledge_tokens = sum(
        estimate_tokens(item["content"])
        for item in knowledge_materials
        if not (
            item["source_kind"] == "upload" and item["source_id"] in selected_uploads
        )
    )
    knowledge_has_allowed = any(
        knowledge_allowed_by_kind[item["source_kind"]]
        and not (
            item["source_kind"] == "upload" and item["source_id"] in selected_uploads
        )
        for item in knowledge_materials
    )
    sections = [
        ContextSection(
            kind="system",
            estimated_tokens=estimate_tokens(
                payload.system_prompt
                or "You are a helpful personal AI assistant. Be direct and accurate."
            ),
        ),
        ContextSection(
            kind="history",
            estimated_tokens=estimate_tokens(history_text),
            included=history_allowed,
            reason=(
                f"{len(older_history)} older messages summarized; latest "
                f"{len(recent_history)} kept verbatim"
                if history_allowed and history_summary
                else None
                if history_allowed
                else "Provider policy defaults to prompt only"
            ),
        ),
        ContextSection(
            kind="memory",
            estimated_tokens=estimate_tokens(memory_text),
            included=memory_allowed,
            reason=None
            if memory_allowed
            else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="retrieval",
            estimated_tokens=sum(
                estimate_tokens(str(item.get("text") or item.get("content") or ""))
                for item in retrieval_hits
            ),
            included=retrieval_allowed,
            reason=None
            if retrieval_allowed
            else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="attachments",
            estimated_tokens=estimate_tokens(upload_text),
            included=attachment_allowed,
            reason=None
            if attachment_allowed
            else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="web",
            estimated_tokens=estimate_tokens(web_text),
            included=web_allowed,
            reason=None
            if web_allowed
            else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="backpack",
            included=backpack_allowed,
            reason=None
            if backpack_allowed
            else "Disabled by provider policy or run settings",
        ),
        ContextSection(
            kind="knowledge",
            estimated_tokens=knowledge_tokens,
            included=bool(knowledge_base and knowledge_has_allowed),
            reason=(
                None
                if knowledge_base and knowledge_has_allowed
                else "No bound knowledge base or its sources are blocked by provider policy"
            ),
        ),
        ContextSection(kind="user", estimated_tokens=estimate_tokens(payload.content)),
    ]
    sources: list[ContextSource] = []
    if history_allowed:
        if history_summary:
            sources.append(
                ContextSource(
                    id=_history_summary_id(older_history),
                    kind="history_summary",
                    title="Earlier conversation summary",
                    preview=history_summary,
                    estimated_tokens=estimate_tokens(history_summary),
                )
            )
        sources.extend(
            ContextSource(
                id=item.id,
                kind="history",
                title=f"{item.role.title()} message",
                preview=item.content[:160],
                estimated_tokens=estimate_tokens(item.content),
            )
            for item in recent_history
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
    upload_text_by_id = {upload_id: content for upload_id, _, content in uploads}
    sources.extend(
        ContextSource(
            id=item.id,
            kind="attachment",
            title=item.filename,
            preview=upload_text_by_id.get(item.id, "Image attachment")[:160],
            estimated_tokens=estimate_tokens(upload_text_by_id.get(item.id, "")),
        )
        for item in upload_records
    )
    sources.extend(
        ContextSource(
            id=str(item.get("id", "")),
            kind="retrieval",
            title=str(item.get("title") or item.get("doc") or "Related conversation"),
            preview=str(item.get("text") or item.get("content") or "")[:500],
            estimated_tokens=estimate_tokens(
                str(item.get("text") or item.get("content") or "")
            ),
            score=float(item.get("similarity") or item.get("score") or 0),
            conversation_id=str(item.get("conv_id")) if item.get("conv_id") else None,
        )
        for item in retrieval_hits
        if item.get("id") and (item.get("text") or item.get("content"))
    )
    if web_allowed:
        sources.extend(
            ContextSource(
                id=hashlib.sha256(item["url"].encode()).hexdigest()[:16],
                kind="web",
                title=item.get("title") or item["url"],
                preview=item.get("snippet", "")[:500],
                url=item["url"],
                estimated_tokens=estimate_tokens(item.get("snippet", "")),
            )
            for item in web_results
            if item.get("url")
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
    knowledge_by_id = {item["id"]: item for item in knowledge_materials}
    for item in knowledge_materials:
        allowed = knowledge_allowed_by_kind[item["source_kind"]]
        duplicate_upload = (
            item["source_kind"] == "upload" and item["source_id"] in selected_uploads
        )
        if duplicate_upload:
            continue
        sources.append(
            ContextSource(
                id=item["id"],
                kind="knowledge",
                title=item["title"],
                preview=item["content"][:500],
                estimated_tokens=estimate_tokens(item["content"]),
                included=allowed,
            )
        )
    findings = scan_text(payload.content)
    # Every context source (history, memory, upload, retrieval, web,
    # knowledge...) is itself scanned for prompt-injection phrasing — content
    # here can originate from a web search result, an uploaded document, or
    # another conversation's retrieved text, all untrusted relative to the
    # user's direct input. A hit demotes the source to "suspicious" and
    # excludes it by default; only injection findings do this (secret/pii
    # findings on a source aren't checked here, only on the raw user payload
    # above).
    for source in sources:
        source_findings = [
            item
            for item in scan_text(
                knowledge_by_id.get(source.id, {}).get("content", source.preview)
            )
            if item.category == "prompt_injection"
        ]
        if source_findings:
            source.trust = "suspicious"
            source.included = False
            for item in source_findings:
                # Re-hashed with the owning source's id mixed in, since
                # scan_text's ids are only unique within a single scanned
                # string and could otherwise collide across different sources.
                item.id = hashlib.sha256(f"{source.id}:{item.id}".encode()).hexdigest()[
                    :12
                ]
            findings.extend(source_findings)
    section_by_kind = {section.kind: section for section in sections}
    section_kind = {"attachment": "attachments", "history_summary": "history"}
    for source in sources:
        if source.included:
            continue
        section = section_by_kind.get(section_kind.get(source.kind, source.kind))
        if section:
            section.estimated_tokens = max(
                0, section.estimated_tokens - source.estimated_tokens
            )
    # Only 80% of context_limit is budgeted for retrieved/injected context,
    # leaving headroom for the model's own response and any framing overhead
    # not accounted for by estimate_tokens.
    budget = max(1, int(payload.context_limit * 0.8))
    estimated = sum(
        section.estimated_tokens for section in sections if section.included
    )
    prune_order = {
        "history": 0,
        "history_summary": 0,
        "retrieval": 1,
        "web": 2,
        "memory": 3,
        "attachment": 4,
        "backpack": 5,
        "knowledge": 6,
    }
    # Pruned lowest-priority-first when over budget: prune_order ranks
    # auto-retrieved kinds (history, retrieval, web, memory) ahead of
    # user-selected ones (attachment, backpack, knowledge); within a kind,
    # lower-scoring sources go first (score defaults to 0 for kinds that
    # don't have one, e.g. history/memory, so those are pruned in their
    # original order since Python's sort is stable).
    for source in sorted(
        sources,
        key=lambda item: (prune_order.get(item.kind, 99), item.score or 0),
    ):
        if estimated <= budget:
            break
        if not source.included:
            continue
        source.included = False
        section = section_by_kind.get(section_kind.get(source.kind, source.kind))
        if section and section.included:
            removed = min(section.estimated_tokens, source.estimated_tokens)
            section.estimated_tokens -= removed
            estimated -= removed
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
        compression_applied=history_allowed and bool(history_summary),
        compressed_message_count=len(older_history) if history_allowed else 0,
    )


def assemble_messages(
    store: Store,
    conversation_id: str,
    payload: TurnPreflight,
    plan: ContextPlan,
    excluded_source_ids: set[str] | None = None,
    web_results: list[dict[str, str]] | None = None,
) -> list[ChatMessage]:
    """Render an already-computed ContextPlan into the ChatMessage list sent to a provider.

    Only sources that are plan-included, trust == "trusted" (scan_text found
    nothing on them), and not explicitly excluded by the caller
    (excluded_source_ids, from the user unchecking a source in the UI) are
    folded into the system prompt or history messages — a "suspicious"
    source from build_context_plan is never included here even if the caller
    doesn't list it in excluded_source_ids.
    """
    excluded = excluded_source_ids or set()
    included = {section.kind: section.included for section in plan.sections}
    approved_sources = {
        source.id
        for source in plan.sources
        if source.included and source.trust == "trusted" and source.id not in excluded
    }
    messages: list[ChatMessage] = []
    system_parts = [
        payload.system_prompt.strip()
        or "You are a helpful personal AI assistant. Be direct and accurate."
    ]
    focus = store.active_focus(conversation_id)
    if focus:
        system_parts.append(
            "Focus objective: "
            f"{focus.objective}\nSuccess criteria: {focus.success_criteria}\n"
            f"Constraints: {', '.join(focus.constraints) or 'None'}"
        )
    if payload.backpack_id and included.get("backpack"):
        backpack = store.get_backpack(payload.backpack_id)
        items = [item for item in backpack.items if item.id in approved_sources]
        if items:
            system_parts.append(
                "Context backpack:\n"
                + "\n".join(f"- {item.title}: {item.content}" for item in items)
            )
    knowledge_base_id = store.get_conversation(
        conversation_id
    ).settings.knowledge_base_id
    if knowledge_base_id and included.get("knowledge"):
        try:
            knowledge_base = store.get_knowledge_base(knowledge_base_id)
            materials = [
                item
                for item in store.knowledge_base_materials(knowledge_base_id)
                if item["id"] in approved_sources
            ]
        except KeyError:
            materials = []
            knowledge_base = None
        if knowledge_base and materials:
            system_parts.append(
                f"Knowledge base: {knowledge_base.name}\n"
                + "\n\n".join(
                    f"[{item['title']}]\n{item['content']}" for item in materials
                )
            )
    if included.get("memory"):
        memories = [
            item
            for item in store.list_memories()
            if item.status == "active" and item.id in approved_sources
        ]
        if memories:
            system_parts.append(
                "Long-term memory:\n"
                + "\n".join(f"- [{item.category}] {item.content}" for item in memories)
            )
    if included.get("attachments"):
        uploads = [
            item
            for item in store.upload_texts(conversation_id)
            if item[0] in approved_sources
        ]
        if uploads:
            system_parts.append(
                "Uploaded documents:\n"
                + "\n\n".join(
                    f"[{filename}]\n{content}" for _, filename, content in uploads
                )
            )
    if included.get("retrieval"):
        retrieved = [
            source
            for source in plan.sources
            if source.kind == "retrieval"
            and source.included
            and source.trust == "trusted"
            and source.id not in excluded
        ]
        if retrieved:
            system_parts.append(
                "Related prior context:\n"
                + "\n\n".join(
                    f"[{source.title}]\n{source.preview}" for source in retrieved
                )
            )
    if included.get("web") and web_results:
        approved_ids = {
            source.id
            for source in plan.sources
            if source.kind == "web" and source.included and source.trust == "trusted"
        }
        web_context = []
        for item in web_results:
            source_id = hashlib.sha256(item.get("url", "").encode()).hexdigest()[:16]
            if source_id in approved_ids and source_id not in excluded:
                web_context.append(
                    f"[{item.get('title') or item.get('url')}]({item.get('url')})\n"
                    f"{item.get('snippet', '')}"
                )
        if web_context:
            system_parts.append("Web search results:\n" + "\n\n".join(web_context))
    history_messages: list[ChatMessage] = []
    if included.get("history"):
        conversation = store.get_conversation(conversation_id)
        older_history, recent_history, history_summary = _history_parts(
            conversation, payload.auto_compress_history
        )
        if (
            history_summary
            and _history_summary_id(older_history) in approved_sources
            and _history_summary_id(older_history) not in excluded
        ):
            system_parts.append(
                "Earlier conversation summary (automatically compressed locally):\n"
                + history_summary
            )
        history_messages.extend(
            ChatMessage(role=item.role, content=item.content)
            for item in recent_history
            if item.id in approved_sources and item.id not in excluded
        )
    messages.append(ChatMessage(role="system", content="\n\n".join(system_parts)))
    messages.extend(history_messages)
    # Images are attached to the final user message (not folded into the
    # system prompt text like other context), matching how provider adapters
    # expect multimodal input (see providers.py).
    images = []
    if included.get("attachments"):
        images = [
            ImageInput(mime=mime, data_base64=data)
            for upload_id, _filename, mime, data in store.upload_images(conversation_id)
            if upload_id in approved_sources
        ]
    messages.append(ChatMessage(role="user", content=payload.content, images=images))
    return messages


def _redact(value: str) -> str:
    # Used only for SafetyFinding previews (scan_text) — short matches are
    # fully masked rather than partially shown, since 8 characters isn't
    # enough to usefully show a prefix/suffix without revealing most of it.
    if len(value) <= 8:
        return "••••"
    return f"{value[:3]}…{value[-4:]}"
