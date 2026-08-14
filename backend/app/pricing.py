from __future__ import annotations

import os

from backend.app.contracts import ModelPricing


OPENAI_PRICING = "https://developers.openai.com/api/docs/models"
ANTHROPIC_PRICING = "https://docs.anthropic.com/en/docs/about-claude/pricing"
GEMINI_PRICING = "https://ai.google.dev/gemini-api/docs/pricing"
XAI_PRICING = "https://docs.x.ai/developers/pricing"
AGNES_PRICING = "https://www.agnes-ai.com/en/docs/agnes-25-flash#limits-and-pricing"
OPENCODE_PRICING = "https://opencode.ai/docs/zen/#pricing"
OPENROUTER_PRICING = "https://openrouter.ai/docs/api/api-reference/models/get-models"


def _price(input_rate: float, output_rate: float, source_url: str) -> ModelPricing:
    return ModelPricing(
        input_per_million=input_rate,
        output_per_million=output_rate,
        source_url=source_url,
    )


def model_pricing(provider: str, model: str) -> ModelPricing | None:
    name = model.lower()
    if provider in {"echo", "ollama-local"}:
        return _price(0, 0, "https://ollama.com/")
    if provider == "agnes" and name == "agnes-2.5-flash":
        return _price(0, 0, AGNES_PRICING)
    if provider == "openai" and os.getenv("OPENAI_BASE_URL", "").rstrip("/") not in {
        "",
        "https://api.openai.com/v1",
    }:
        return None

    tables: dict[str, tuple[tuple[str, float, float], ...]] = {
        "openai": (
            ("gpt-5.4-mini", 0.75, 4.5),
            ("gpt-5.4-nano", 0.2, 1.25),
            ("gpt-5.5", 5, 30),
            ("gpt-5.4", 2.5, 15),
        ),
        "anthropic": (
            ("claude-opus-5", 5, 25),
            ("claude-opus-4-8", 5, 25),
            ("claude-opus-4-7", 5, 25),
            ("claude-opus-4-6", 5, 25),
            ("claude-opus-4-5", 5, 25),
            ("claude-sonnet-5", 2, 10),
            ("claude-sonnet-4-6", 3, 15),
            ("claude-sonnet-4-5", 3, 15),
            ("claude-haiku-4-5", 1, 5),
        ),
        "gemini": (
            ("gemini-3.5-flash", 1.5, 9),
            ("gemini-3.1-flash-lite", 0.25, 1.5),
            ("gemini-3.1-pro", 2, 12),
            ("gemini-3-flash", 0.5, 3),
            ("gemini-2.5-flash-lite", 0.1, 0.4),
            ("gemini-2.5-flash", 0.3, 2.5),
        ),
        "xai": (
            ("grok-4.5", 2, 6),
            ("grok-build-0.1", 1, 2),
            ("grok-4.3", 1.25, 2.5),
            ("grok-4.20", 1.25, 2.5),
        ),
        "opencode-zen": (
            ("claude-opus-4-6", 5, 25),
            ("claude-opus-4-5", 5, 25),
            ("claude-sonnet-4-6", 3, 15),
            ("claude-sonnet-4-5", 3, 15),
            ("minimax-m2.5", 0.3, 1.2),
            ("glm-5.1", 1.4, 4.4),
            ("glm-5", 1, 3.2),
            ("kimi-k2.5", 0.6, 3),
            ("qwen3.6-plus", 0.5, 3),
            ("qwen3.5-plus", 0.2, 1.2),
        ),
    }
    sources = {
        "openai": OPENAI_PRICING,
        "anthropic": ANTHROPIC_PRICING,
        "gemini": GEMINI_PRICING,
        "xai": XAI_PRICING,
        "opencode-zen": OPENCODE_PRICING,
    }
    for prefix, input_rate, output_rate in tables.get(provider, ()):
        if name.startswith(prefix):
            return _price(input_rate, output_rate, sources[provider])
    return None


def openrouter_pricing(raw: object) -> ModelPricing | None:
    if not isinstance(raw, dict):
        return None
    try:
        return _price(
            float(raw["prompt"]) * 1_000_000,
            float(raw["completion"]) * 1_000_000,
            OPENROUTER_PRICING,
        )
    except (KeyError, TypeError, ValueError):
        return None
