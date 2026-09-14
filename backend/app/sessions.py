"""Per-browser-session credential storage, with a fallback to server environment variables.

SessionVault holds API keys a user has pasted into the UI, scoped to their
session id (see main.py's session_cookie middleware) and never persisted to
disk — restarting the server means a user must re-enter cloud credentials,
falling back to whatever PROVIDER_ENV variables are configured on the host in
the meantime. PROVIDER_ENV is also the authoritative list of provider ids the
app knows about — main.py fails fast at startup if a registered provider
adapter has no entry here.
"""

from __future__ import annotations

import os
import threading
import uuid


# A None value means that provider has no environment-variable fallback (e.g.
# ollama-local needs no key at all; opencode-bridge authenticates via its own
# OAuth flow, not an API key).
PROVIDER_ENV: dict[str, str | None] = {
    "ollama-local": None,
    "ollama-cloud": "OLLAMA_API_KEY",
    "openai": "OPENAI_API_KEY",
    "agnes": "AGNES_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "xai": "XAI_API_KEY",
    "omniroute": "OMNIROUTE_API_KEY",
    "opencode-bridge": None,
    "opencode-zen": "OPENCODE_ZEN_API_KEY",
    "opencode-go": "OPENCODE_GO_API_KEY",
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

    def clear(self, session_id: str) -> None:
        with self._lock:
            self._values.pop(session_id, None)

    def get(self, session_id: str, provider: str) -> str | None:
        # Session-scoped key (pasted into the UI) always wins over the
        # server's own environment variable when both are present.
        with self._lock:
            value = self._values.get(session_id, {}).get(provider)
        env_name = PROVIDER_ENV[provider]
        return value or (os.getenv(env_name) if env_name else None)

    def source(self, session_id: str, provider: str) -> str | None:
        # Reports where a usable credential would come from without exposing
        # its value — used by main.py's /providers listing to show connection
        # status. anthropic is the only provider with a third source
        # (workload identity federation) beyond session/env.
        with self._lock:
            if self._values.get(session_id, {}).get(provider):
                return "session"
        env_name = PROVIDER_ENV[provider]
        if env_name and os.getenv(env_name):
            return "env"
        if provider == "anthropic" and _anthropic_wif_configured():
            return "wif"
        return None


def _anthropic_wif_configured() -> bool:
    """Report whether Anthropic workload-identity federation looks configured.

    This only reflects presence of the profile/identity-token environment
    variables, without validating that they actually authenticate. The real
    authentication happens inside the Anthropic SDK when
    providers.AnthropicAdapter._client constructs a client with no api_key,
    letting the SDK fall back to whatever WIF environment variables it reads
    itself.
    """
    if os.getenv("ANTHROPIC_PROFILE"):
        return True
    required = (
        "ANTHROPIC_FEDERATION_RULE_ID",
        "ANTHROPIC_ORGANIZATION_ID",
        "ANTHROPIC_SERVICE_ACCOUNT_ID",
    )
    identity = os.getenv("ANTHROPIC_IDENTITY_TOKEN") or os.getenv(
        "ANTHROPIC_IDENTITY_TOKEN_FILE"
    )
    return bool(identity and all(os.getenv(name) for name in required))
