"""Generate short use-hints for models from Ollama API metadata.

Purely rule-based on runtime metadata (capabilities, name patterns, size) so
any newly pulled model gets a sensible 2-3 word hint with zero code changes.
"""

from __future__ import annotations

import re

from src.ollama_client import ModelInfo

# Name-pattern specialisations, checked in order; first match wins the lead tag.
_NAME_HINTS: list[tuple[str, str]] = [
    (r"coder|code", "coding"),
    (r"ocr", "document OCR"),
    (r"med", "medical"),
    (r"translate", "translation"),
    (r"function|tool", "function calls"),
    (r"math", "math"),
    (r"sql", "SQL"),
    (r"guard|shield", "safety filter"),
    (r"embed", "embeddings"),
]


def _size_tag(m: ModelInfo) -> str:
    if m.is_cloud:
        return "cloud, powerful"
    gb = m.size_gb
    if gb < 1.0:
        return "tiny, instant"
    if gb < 2.5:
        return "fast, light"
    if gb < 5.0:
        return "balanced"
    return "strongest, slower"


def hint_for(m: ModelInfo) -> str:
    """A 2-3 word use hint, e.g. 'vision, reasoning' or 'coding, fast'."""
    tags: list[str] = []
    base = m.name.lower()
    for pattern, tag in _NAME_HINTS:
        if re.search(pattern, base):
            tags.append(tag)
            break
    if m.is_vision:
        tags.append("vision")
    if m.is_thinking:
        tags.append("reasoning")
    if "tools" in m.capabilities and "function calls" not in tags:
        tags.append("tools")
    if not tags:
        tags.append("general chat")
    # Cap at two trait tags, then one size/speed tag
    label = ", ".join(dict.fromkeys(tags[:2]))
    return f"{label} · {_size_tag(m)}"


def dropdown_label(m: ModelInfo) -> str:
    """Full dropdown line: name — hint (size)."""
    size = "cloud" if m.is_cloud else f"{m.size_gb:.1f} GB"
    return f"{m.name}  —  {hint_for(m)}  ({size})"
