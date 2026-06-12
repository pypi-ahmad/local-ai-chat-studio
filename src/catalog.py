"""Unified model catalog shared by the chat page and the Compare page."""

from __future__ import annotations

from dataclasses import dataclass

from src import providers
from src.model_labels import hint_for
from src.ollama_client import ModelInfo, chat_models

PROVIDER_BADGES = {
    "Ollama (local)": "🦙",
    "Ollama (cloud)": "☁️",
    "OpenAI": "🟢",
    "Anthropic": "🟣",
    "OpenRouter": "🔻",
    "xAI (Grok)": "⚫",
    "Google Gemini": "🔷",
}


@dataclass
class SelectedModel:
    """Uniform view over an Ollama model or a cloud-provider model."""

    key: str  # 'ollama::<name>' or '<provider>::<id>'
    provider: str
    name: str
    hint: str  # short, for the dropdown line
    detail: str  # longer (capabilities / cloud-api), shown as a caption
    is_vision: bool
    group: str  # provider category, e.g. "Ollama (local)" / "OpenRouter"
    group_rank: int  # ordering: local first, then cloud Ollama, then providers
    context_length: int | None = None

    @property
    def badge(self) -> str:
        return PROVIDER_BADGES.get(self.group, "🔌")


def normalize_model_key(value: str) -> str:
    """Old conversations stored bare Ollama names; map them to unified keys."""
    return value if "::" in value else f"ollama::{value}"


def build_model_catalog(
    models: list[ModelInfo],
    show_cloud: bool,
    provider_models: dict[str, list[providers.ApiModel]],
) -> dict[str, SelectedModel]:
    """Unified {key: SelectedModel}, ordered and grouped by provider."""
    catalog: dict[str, SelectedModel] = {}
    for m in chat_models(models, include_cloud=show_cloud):
        key = f"ollama::{m.name}"
        group = "Ollama (cloud)" if m.is_cloud else "Ollama (local)"
        size = "cloud" if m.is_cloud else f"{m.size_gb:.1f} GB"
        catalog[key] = SelectedModel(
            key=key,
            provider="ollama",
            name=m.name,
            hint=f"{hint_for(m)} · {size}",
            detail="capabilities: " + " · ".join(m.capabilities or ["completion"]),
            is_vision=m.is_vision,
            group=group,
            group_rank=0 if not m.is_cloud else 1,
            context_length=m.context_length,
        )
    for provider, api_models in provider_models.items():
        label = providers.PROVIDERS[provider]["label"]
        for am in api_models:
            catalog[am.key] = SelectedModel(
                key=am.key,
                provider=provider,
                name=am.id,
                hint=am.hint,
                detail="cloud API",
                is_vision=am.is_vision,
                group=label,
                group_rank=2,
                context_length=am.context_length,
            )
    return catalog


def ordered_keys(catalog: dict[str, SelectedModel], group_filter: str | None) -> list[str]:
    """Keys ordered by (group_rank, group, name); optionally filtered to one group."""
    items = [v for v in catalog.values() if group_filter in (None, "All", v.group)]
    items.sort(key=lambda v: (v.group_rank, v.group.lower(), v.name.lower()))
    return [v.key for v in items]


def present_groups(catalog: dict[str, SelectedModel]) -> list[str]:
    """Distinct provider groups present, in display order."""
    seen: dict[str, int] = {}
    for v in catalog.values():
        seen.setdefault(v.group, v.group_rank)
    return [g for g, _ in sorted(seen.items(), key=lambda kv: (kv[1], kv[0].lower()))]


def best_coding_model(catalog: dict[str, SelectedModel]) -> str | None:
    """Pick the best available model for the built-in Coding Agent preset."""
    coders = [v for v in catalog.values() if "coder" in v.name.lower() or "code" in v.name.lower()]
    if coders:  # prefer local coder, then cloud
        coders.sort(key=lambda v: v.group_rank)
        return coders[0].key
    # fall back to the largest local general model
    local = [v for v in catalog.values() if v.group_rank == 0]
    return local[0].key if local else (next(iter(catalog), None))
