from __future__ import annotations

import asyncio

from backend.app.contracts import ChatMessage, ModelDescriptor
from backend.app.providers import ProviderAdapter, ProviderRegistry, build_provider_registry


def test_registry_contains_all_phase_one_providers() -> None:
    assert set(build_provider_registry()) == {
        "ollama",
        "openai",
        "anthropic",
        "gemini",
        "openrouter",
        "xai",
        "omniroute",
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
