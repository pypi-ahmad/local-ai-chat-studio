"""BYOK cloud providers: OpenAI, Anthropic, OpenRouter, xAI, Gemini.

Models are always fetched live from each provider's models endpoint, so newly
released models appear automatically — same zero-code-change principle as the
Ollama integration. Anthropic uses the official ``anthropic`` SDK; the others
speak the OpenAI-compatible API via the ``openai`` SDK.

API keys are kept ONLY in the server's process memory for the session — never
written to disk, logged, or exported. Environment variables are supported as a
read-only fallback. Keys never leave this machine except to their own provider.
"""

from __future__ import annotations

import base64
import os
import re
import threading
from dataclasses import dataclass, field
from typing import Any, Iterator

import httpx
from loguru import logger

from src.config import config

PROVIDERS: dict[str, dict[str, Any]] = {
    "openai": {
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "env": "OPENAI_API_KEY",
        "key_url": "https://platform.openai.com/api-keys",
        "vision_patterns": [r"gpt-4o", r"gpt-4\.1", r"gpt-5", r"^o[3-9]", r"omni"],
        "exclude_patterns": [
            r"whisper", r"tts", r"dall-e", r"embedding", r"moderation", r"audio",
            r"realtime", r"transcribe", r"image", r"davinci", r"babbage", r"sora",
            r"computer-use", r"codex",
        ],
    },
    "anthropic": {
        "label": "Anthropic",
        "env": "ANTHROPIC_API_KEY",
        "key_url": "https://platform.claude.com/settings/keys",
        "vision_patterns": [r"claude"],  # all current Claude models accept images
        "exclude_patterns": [],
    },
    "openrouter": {
        "label": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "env": "OPENROUTER_API_KEY",
        "key_url": "https://openrouter.ai/keys",
        "vision_patterns": [],  # resolved from API modality metadata
        "exclude_patterns": [],
        "oauth": True,  # supports PKCE "login with account"
    },
    "xai": {
        "label": "xAI (Grok)",
        "base_url": "https://api.x.ai/v1",
        "env": "XAI_API_KEY",
        "key_url": "https://console.x.ai/",
        "vision_patterns": [r"vision", r"grok-[4-9]"],
        "exclude_patterns": [r"image"],
    },
    "gemini": {
        "label": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "env": "GEMINI_API_KEY",
        "key_url": "https://aistudio.google.com/apikey",
        "vision_patterns": [r"gemini"],  # Gemini chat models are multimodal
        "exclude_patterns": [
            r"embedding", r"imagen", r"veo", r"aqa", r"tts", r"image", r"audio",
            r"learnlm", r"gemma-.*-it$",
        ],
    },
}

_HINT_PATTERNS: list[tuple[str, str]] = [
    (r"coder|codex|code", "coding"),
    (r"o[3-9]|thinking|reason|r1", "reasoning"),
    (r"mini|nano|flash|lite|haiku|small", "fast, cheap"),
    (r"opus|pro|large|ultra", "strongest"),
]


@dataclass
class ApiModel:
    provider: str
    id: str
    is_vision: bool = False
    context_length: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def key(self) -> str:
        return f"{self.provider}::{self.id}"

    @property
    def hint(self) -> str:
        tags = []
        low = self.id.lower()
        for pattern, tag in _HINT_PATTERNS:
            if re.search(pattern, low):
                tags.append(tag)
                break
        if self.is_vision:
            tags.append("vision")
        if not tags:
            tags.append("general chat")
        return ", ".join(tags[:2])

    @property
    def dropdown_label(self) -> str:
        return f"{self.id}  —  {self.hint} · cloud API  ({PROVIDERS[self.provider]['label']})"


# --- key storage (IN-MEMORY ONLY — never written to disk) -------------------------
# Security posture: API keys live only in the running server's process memory for
# the lifetime of the session. They are NEVER persisted to disk, logged, exported,
# or sent anywhere except the provider they belong to. Restarting the app wipes
# them. A read-only fallback to environment variables is supported (those are set
# by the user outside the app; we never write them). The store is guarded by a
# lock because background generation threads read it too.

_secrets: dict[str, str] = {}
_secrets_lock = threading.Lock()

OLLAMA_CLOUD_URL = "https://ollama.com"
_OLLAMA_HOST_KEY = "__ollama_host__"
_OLLAMA_API_KEY = "__ollama_key__"


def _get_secret(name: str) -> str | None:
    with _secrets_lock:
        return _secrets.get(name)


def _set_secret(name: str, value: str | None) -> None:
    with _secrets_lock:
        if value:
            _secrets[name] = value
        else:
            _secrets.pop(name, None)


def get_api_key(provider: str) -> str | None:
    return _get_secret(provider) or os.environ.get(PROVIDERS[provider]["env"]) or None


def key_source(provider: str) -> str | None:
    """'session' (in-memory) | 'env' | None — where the active key comes from."""
    if _get_secret(provider):
        return "session"
    if os.environ.get(PROVIDERS[provider]["env"]):
        return "env"
    return None


def set_api_key(provider: str, key: str) -> None:
    _set_secret(provider, (key or "").strip() or None)


def remove_api_key(provider: str) -> None:
    _set_secret(provider, None)


def configured_providers() -> list[str]:
    return [p for p in PROVIDERS if get_api_key(p)]


def clear_all_secrets() -> None:
    """Wipe every in-memory key (used by a 'forget all keys' control)."""
    with _secrets_lock:
        _secrets.clear()


# --- Ollama endpoint configuration (host + optional API key) ----------------------
# Point the app at a local server, a remote Ollama, or Ollama's hosted cloud
# (https://ollama.com) with an API key — also in-memory only.

def get_ollama_host() -> str:
    return _get_secret(_OLLAMA_HOST_KEY) or os.environ.get("CHAT_OLLAMA_HOST") or config.ollama_host


def get_ollama_key() -> str | None:
    return _get_secret(_OLLAMA_API_KEY) or os.environ.get("OLLAMA_API_KEY") or None


def ollama_key_source() -> str | None:
    if _get_secret(_OLLAMA_API_KEY):
        return "session"
    if os.environ.get("OLLAMA_API_KEY"):
        return "env"
    return None


def set_ollama_config(host: str, api_key: str | None) -> None:
    _set_secret(_OLLAMA_HOST_KEY, (host or "").strip() or config.ollama_host)
    _set_secret(_OLLAMA_API_KEY, (api_key or "").strip() or None)


def reset_ollama_config() -> None:
    _set_secret(_OLLAMA_HOST_KEY, None)
    _set_secret(_OLLAMA_API_KEY, None)


# --- model discovery ----------------------------------------------------------------

def _excluded(provider: str, model_id: str) -> bool:
    low = model_id.lower()
    return any(re.search(p, low) for p in PROVIDERS[provider]["exclude_patterns"])


def _vision_by_pattern(provider: str, model_id: str) -> bool:
    low = model_id.lower()
    return any(re.search(p, low) for p in PROVIDERS[provider]["vision_patterns"])


def list_provider_models(provider: str) -> list[ApiModel]:
    """Live model list from the provider's API. Raises on auth/network errors."""
    api_key = get_api_key(provider)
    if not api_key:
        return []
    if provider == "anthropic":
        return _list_anthropic(api_key)
    if provider == "openrouter":
        return _list_openrouter(api_key)
    return _list_openai_compat(provider, api_key)


def _list_anthropic(api_key: str) -> list[ApiModel]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    models = []
    for m in client.models.list():
        models.append(ApiModel(provider="anthropic", id=m.id, is_vision=True))
    return models


def _list_openrouter(api_key: str) -> list[ApiModel]:
    # /models is public and returns rich metadata (modalities, context length)
    resp = httpx.get(
        f"{PROVIDERS['openrouter']['base_url']}/models",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    resp.raise_for_status()
    models = []
    for m in resp.json().get("data", []):
        arch = m.get("architecture") or {}
        modalities = arch.get("input_modalities") or []
        models.append(
            ApiModel(
                provider="openrouter",
                id=m["id"],
                is_vision="image" in modalities,
                context_length=m.get("context_length"),
            )
        )
    return sorted(models, key=lambda m: m.id)


def _list_openai_compat(provider: str, api_key: str) -> list[ApiModel]:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=PROVIDERS[provider]["base_url"])
    models = []
    for m in client.models.list():
        if _excluded(provider, m.id):
            continue
        models.append(
            ApiModel(provider=provider, id=m.id, is_vision=_vision_by_pattern(provider, m.id))
        )
    return sorted(models, key=lambda m: m.id)


def test_connection(provider: str) -> tuple[bool, str]:
    try:
        models = list_provider_models(provider)
        return True, f"Connected — {len(models)} models available."
    except Exception as exc:
        return False, str(exc)


# --- chat -----------------------------------------------------------------------------

def stream_chat(
    provider: str,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.7,
) -> Iterator[str]:
    """Stream a chat completion from a cloud provider.

    ``messages`` use the app's internal shape: {role, content, images?} where
    images is a list of (bytes, mime) tuples on the turn they were uploaded.
    """
    api_key = get_api_key(provider)
    if not api_key:
        raise RuntimeError(f"No API key configured for {PROVIDERS[provider]['label']}.")
    if provider == "anthropic":
        yield from _stream_anthropic(api_key, model, messages)
    else:
        yield from _stream_openai_compat(provider, api_key, model, messages, temperature)


def _stream_anthropic(api_key: str, model: str, messages: list[dict[str, Any]]) -> Iterator[str]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    system = ""
    converted: list[dict[str, Any]] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
            continue
        images = m.get("images") or []
        if images:
            content: list[dict[str, Any]] = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": mime or "image/png",
                        "data": base64.standard_b64encode(img).decode(),
                    },
                }
                for img, mime in images
            ]
            content.append({"type": "text", "text": m["content"]})
            converted.append({"role": m["role"], "content": content})
        else:
            converted.append({"role": m["role"], "content": m["content"]})
    with client.messages.stream(
        model=model,
        max_tokens=8192,
        system=system or anthropic.NOT_GIVEN,
        messages=converted,
    ) as stream:
        yield from stream.text_stream


def _stream_openai_compat(
    provider: str,
    api_key: str,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float,
) -> Iterator[str]:
    from openai import OpenAI

    extra_headers = {}
    if provider == "openrouter":
        extra_headers = {"X-Title": "Local AI Chat Studio"}
    client = OpenAI(api_key=api_key, base_url=PROVIDERS[provider]["base_url"])
    converted: list[dict[str, Any]] = []
    for m in messages:
        images = m.get("images") or []
        if images:
            content: list[dict[str, Any]] = [{"type": "text", "text": m["content"]}]
            for img, mime in images:
                b64 = base64.standard_b64encode(img).decode()
                content.append(
                    {"type": "image_url", "image_url": {"url": f"data:{mime or 'image/png'};base64,{b64}"}}
                )
            converted.append({"role": m["role"], "content": content})
        else:
            converted.append({"role": m["role"], "content": m["content"]})
    stream = client.chat.completions.create(
        model=model,
        messages=converted,
        temperature=temperature,
        stream=True,
        extra_headers=extra_headers or None,
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


# --- OpenRouter OAuth PKCE ("login with account") -----------------------------------

_OR_VERIFIER_KEY = "__openrouter_verifier__"


def openrouter_auth_url(callback_url: str) -> str:
    """Start the PKCE flow: generate an in-memory verifier, return the auth URL.

    The verifier is a short-lived secret kept in process memory only (never on
    disk); it survives the browser round-trip because the server process stays up.
    """
    import hashlib
    import secrets

    verifier = secrets.token_urlsafe(48)
    _set_secret(_OR_VERIFIER_KEY, verifier)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return (
        "https://openrouter.ai/auth"
        f"?callback_url={callback_url}"
        f"&code_challenge={challenge}&code_challenge_method=S256"
    )


def openrouter_exchange_code(code: str) -> bool:
    """Finish the PKCE flow: exchange the callback code for an API key (kept in memory)."""
    verifier = _get_secret(_OR_VERIFIER_KEY)
    if not verifier:
        return False
    try:
        resp = httpx.post(
            "https://openrouter.ai/api/v1/auth/keys",
            json={"code": code, "code_verifier": verifier, "code_challenge_method": "S256"},
            timeout=30,
        )
        resp.raise_for_status()
        key = resp.json().get("key")
        if key:
            set_api_key("openrouter", key)
            _set_secret(_OR_VERIFIER_KEY, None)
            return True
    except Exception as exc:
        logger.warning("OpenRouter code exchange failed: {}", exc)
    return False
