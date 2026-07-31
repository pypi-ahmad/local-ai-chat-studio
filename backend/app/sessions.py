from __future__ import annotations

import os
import threading
import uuid


PROVIDER_ENV = {
    "ollama": "OLLAMA_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "xai": "XAI_API_KEY",
    "omniroute": "OMNIROUTE_API_KEY",
}


class SessionVault:
    def __init__(self) -> None:
        self._values: dict[str, dict[str, str]] = {}
        self._lock = threading.RLock()

    @staticmethod
    def new_id() -> str:
        return uuid.uuid4().hex

    def set(self, session_id: str, provider: str, value: str) -> None:
        with self._lock:
            self._values.setdefault(session_id, {})[provider] = value

    def remove(self, session_id: str, provider: str) -> None:
        with self._lock:
            self._values.get(session_id, {}).pop(provider, None)

    def get(self, session_id: str, provider: str) -> str | None:
        with self._lock:
            value = self._values.get(session_id, {}).get(provider)
        return value or os.getenv(PROVIDER_ENV[provider])

    def source(self, session_id: str, provider: str) -> str | None:
        with self._lock:
            if self._values.get(session_id, {}).get(provider):
                return "session"
        return "env" if os.getenv(PROVIDER_ENV[provider]) else None
