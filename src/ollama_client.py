"""Ollama integration: dynamic model discovery, capability checks, streaming chat.

All model knowledge comes from the Ollama API at runtime (``/api/tags`` +
``/api/show``) so the app never needs a code change when models are added,
removed, or the machine is upgraded.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterator

import ollama
from loguru import logger

from src.config import config

_client_cache: dict = {}


def _client() -> ollama.Client:
    """Build (and cache) an Ollama client from the runtime-configured host/key.

    The host and optional API key are read from the Providers settings each call,
    so pointing the app at a remote or hosted Ollama takes effect without a
    restart. The constructed client is cached per (host, key).
    """
    from src import providers  # lazy import to avoid any import cycle at load time

    host = providers.get_ollama_host()
    key = providers.get_ollama_key()
    sig = (host, key)
    client = _client_cache.get(sig)
    if client is None:
        _client_cache.clear()
        headers = {"Authorization": f"Bearer {key}"} if key else None
        client = ollama.Client(host=host, headers=headers)
        _client_cache[sig] = client
    return client


@dataclass
class ModelInfo:
    """A locally known Ollama model with API-reported metadata."""

    name: str
    size_bytes: int
    capabilities: list[str] = field(default_factory=list)
    parameter_size: str = ""
    families: list[str] = field(default_factory=list)
    context_length: int | None = None
    is_cloud: bool = False

    @property
    def size_gb(self) -> float:
        return self.size_bytes / 1e9

    @property
    def is_vision(self) -> bool:
        return "vision" in self.capabilities

    @property
    def is_embedding(self) -> bool:
        return "embedding" in self.capabilities

    @property
    def is_thinking(self) -> bool:
        return "thinking" in self.capabilities


def list_models() -> list[ModelInfo]:
    """Fetch all models Ollama knows about, with capabilities.

    ``/api/tags`` carries capabilities for most models; for entries where it
    is missing we fall back to one ``/api/show`` call (cached by Streamlit at
    the caller level, so this stays cheap).
    """
    models: list[ModelInfo] = []
    resp = _client().list()
    for m in resp.get("models", []):
        raw: dict[str, Any] = dict(m) if not isinstance(m, dict) else m
        name = raw.get("name") or raw.get("model", "")
        details = raw.get("details") or {}
        if hasattr(details, "model_dump"):
            details = details.model_dump()
        capabilities = list(raw.get("capabilities") or [])
        context_length = details.get("context_length")
        if not capabilities:
            try:
                show = _client().show(name)
                capabilities = list(getattr(show, "capabilities", None) or [])
                model_info = getattr(show, "modelinfo", None) or {}
                for key, value in model_info.items():
                    if key.endswith(".context_length"):
                        context_length = context_length or value
            except Exception as exc:  # pragma: no cover - network edge
                logger.warning("ollama show failed for {}: {}", name, exc)
        models.append(
            ModelInfo(
                name=name,
                size_bytes=raw.get("size") or 0,
                capabilities=capabilities,
                parameter_size=details.get("parameter_size", ""),
                families=list(details.get("families") or []),
                context_length=context_length,
                is_cloud=bool(raw.get("remote_host")) or name.endswith(":cloud") or name.endswith("-cloud"),
            )
        )
    return models


def chat_models(models: list[ModelInfo], include_cloud: bool) -> list[ModelInfo]:
    """Models eligible for the chat dropdown (no embedders; cloud optional)."""
    eligible = [m for m in models if not m.is_embedding]
    if not include_cloud:
        eligible = [m for m in eligible if not m.is_cloud]
    # Local models first, then by size descending (strongest at top of each group)
    return sorted(eligible, key=lambda m: (m.is_cloud, -m.size_bytes))


def embedding_model(models: list[ModelInfo]) -> ModelInfo | None:
    """Auto-detect the embedding model: smallest local model with the capability."""
    embedders = [m for m in models if m.is_embedding and not m.is_cloud]
    return min(embedders, key=lambda m: m.size_bytes) if embedders else None


def vision_fallback_model(models: list[ModelInfo]) -> ModelInfo | None:
    """Best local model for describing/reading images on behalf of text-only models.

    Prefers true vision-capable models (smallest first, to spare VRAM); falls
    back to OCR-specialised models detected by name.
    """
    vision = [m for m in models if m.is_vision and not m.is_cloud and not m.is_embedding]
    if vision:
        return min(vision, key=lambda m: m.size_bytes)
    ocr = [m for m in models if "ocr" in m.name.lower() and not m.is_cloud]
    return min(ocr, key=lambda m: m.size_bytes) if ocr else None


_SPECIALIZED = ("ocr", "med", "translate", "function", "guard", "coder", "embed")


def smallest_text_model(models: list[ModelInfo]) -> ModelInfo | None:
    """Small general-purpose local model — used for titles, fact extraction, profiles.

    Skips specialized models (OCR, medical, translation, ...) and prefers the
    smallest general model of at least ~1 GB for output quality.
    """
    candidates = [
        m for m in models
        if not m.is_embedding and not m.is_cloud and not m.is_vision and m.size_bytes > 0
        and not any(s in m.name.lower() for s in _SPECIALIZED)
    ]
    if not candidates:
        return None
    decent = [m for m in candidates if m.size_bytes >= 1e9]
    return min(decent or candidates, key=lambda m: m.size_bytes)


def stream_chat(
    model: str,
    messages: list[dict[str, Any]],
    temperature: float | None = None,
) -> Iterator[str]:
    """Stream a chat completion, yielding content deltas."""
    stream = _client().chat(
        model=model,
        messages=messages,
        stream=True,
        options={"temperature": temperature if temperature is not None else config.temperature},
        keep_alive=config.keep_alive,
    )
    for chunk in stream:
        content = chunk.get("message", {}).get("content", "")
        if content:
            yield content


def generate(model: str, prompt: str, system: str | None = None, temperature: float = 0.2) -> str:
    """Single non-streamed completion for internal tasks (titles, extraction)."""
    messages: list[dict[str, Any]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = _client().chat(
        model=model,
        messages=messages,
        options={"temperature": temperature},
        keep_alive=config.keep_alive,
    )
    return resp["message"]["content"].strip()


def describe_image(model: str, image_bytes: bytes, hint: str = "") -> str:
    """Use a vision/OCR model to extract a faithful description + text of an image."""
    prompt = (
        "Describe this image precisely and transcribe ALL visible text verbatim. "
        "Be factual and complete; this output will be the only thing another "
        "model sees of the image."
    )
    if hint:
        prompt += f" The user said: {hint}"
    resp = _client().chat(
        model=model,
        messages=[{"role": "user", "content": prompt, "images": [image_bytes]}],
        options={"temperature": 0.1},
        keep_alive=config.keep_alive,
    )
    return resp["message"]["content"].strip()


def embed_texts(model: str, texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts with the auto-detected Ollama embedding model."""
    resp = _client().embed(model=model, input=texts)
    return list(resp["embeddings"])


def ollama_alive() -> bool:
    try:
        _client().list()
        return True
    except Exception:
        return False
