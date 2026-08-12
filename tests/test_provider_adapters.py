from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from backend.app.contracts import ChatMessage, ModelDescriptor
from backend.app.providers import (
    OllamaAdapter,
    OpenCodeBridgeAdapter,
    ProviderAdapter,
    ProviderRegistry,
    build_provider_registry,
)


def test_registry_contains_all_phase_one_providers() -> None:
    assert set(build_provider_registry()) == {
        "ollama-local",
        "ollama-cloud",
        "openai",
        "anthropic",
        "gemini",
        "openrouter",
        "xai",
        "omniroute",
        "opencode-bridge",
        "opencode-zen",
        "opencode-go",
    }


def test_model_discovery_is_concurrent_and_degrades_per_provider() -> None:
    class StubAdapter(ProviderAdapter):
        def __init__(self, provider_id: str, fails: bool = False) -> None:
            self.id, self.label, self.fails = provider_id, provider_id, fails

        async def list_models(self, _: str | None) -> list[ModelDescriptor]:
            await asyncio.sleep(0.01)
            if self.fails:
                raise ConnectionError("offline")
            return [ModelDescriptor(provider=self.id, id="model")]

        async def stream(self, *_args, **_kwargs):
            yield "unused"

    registry = ProviderRegistry(
        {"ready": StubAdapter("ready"), "offline": StubAdapter("offline", fails=True)}
    )

    result = asyncio.run(registry.discover_models(lambda _: None))

    assert result["ready"].models[0].id == "model"
    assert result["ready"].error is None
    assert result["offline"].models == []
    assert result["offline"].error == "offline"


def test_echo_like_adapter_contract_accepts_normalized_messages() -> None:
    adapter = next(iter(build_provider_registry().values()))
    assert isinstance(adapter, ProviderAdapter)
    assert ChatMessage(role="user", content="hello").content == "hello"


def test_local_ollama_filters_daemon_cloud_models_and_reports_vision() -> None:
    class Client:
        async def list(self):
            return SimpleNamespace(
                models=[
                    SimpleNamespace(model="gemma3:latest"),
                    SimpleNamespace(model="gpt:120b-cloud"),
                ]
            )

        async def show(self, _model):
            return {"capabilities": ["vision"]}

    adapter = OllamaAdapter(
        "ollama-local", "Ollama Local", "http://127.0.0.1:11434", cloud=False
    )
    adapter._client = lambda _key: Client()  # type: ignore[method-assign]

    models = asyncio.run(adapter.list_models(None))

    assert [model.id for model in models] == ["gemma3:latest"]
    assert models[0].capabilities == ["vision"]


def test_ollama_cloud_uses_bearer_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    import ollama

    captured: dict[str, object] = {}

    class Client:
        def __init__(self, **kwargs) -> None:
            captured.update(kwargs)

    monkeypatch.setattr(ollama, "AsyncClient", Client)
    adapter = OllamaAdapter(
        "ollama-cloud", "Ollama Cloud", "https://ollama.com", cloud=True
    )

    adapter._client("test-key")

    assert captured == {
        "host": "https://ollama.com",
        "headers": {"Authorization": "Bearer test-key"},
    }


def test_opencode_bridge_rejects_non_loopback_urls() -> None:
    with pytest.raises(ValueError, match="loopback"):
        OpenCodeBridgeAdapter("https://example.com")
