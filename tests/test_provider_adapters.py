from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from backend.app.contracts import ChatMessage, ModelDescriptor
from backend.app.providers import (
    OllamaAdapter,
    OpenCodeBridgeAdapter,
    OpenAICompatibleAdapter,
    ProviderAdapter,
    ProviderRegistry,
    build_provider_registry,
)


def test_registry_contains_all_phase_one_providers() -> None:
    assert set(build_provider_registry()) == {
        "ollama-local",
        "ollama-cloud",
        "openai",
        "agnes",
        "anthropic",
        "gemini",
        "openrouter",
        "xai",
        "omniroute",
        "opencode-bridge",
        "opencode-zen",
        "opencode-go",
    }


def test_openai_provider_uses_base_url_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_BASE_URL", "https://openai.example.test/v1")

    adapter = build_provider_registry()["openai"]

    assert adapter.base_url == "https://openai.example.test/v1"  # type: ignore[attr-defined]


def test_luna_uses_its_supported_default_temperature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    captured: dict[str, object] = {}

    class Response:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def __aiter__(self):
            async def chunks():
                yield SimpleNamespace(
                    choices=[SimpleNamespace(delta=SimpleNamespace(content="ok"))]
                )

            return chunks()

    class Completions:
        async def create(self, **kwargs):
            captured.update(kwargs)
            return Response()

    class Models:
        async def list(self):
            return SimpleNamespace(
                data=[
                    SimpleNamespace(id="gpt-5.6-luna"),
                    SimpleNamespace(id="gpt-4.1"),
                ]
            )

    class Client:
        def __init__(self, **_kwargs) -> None:
            self.chat = SimpleNamespace(completions=Completions())
            self.models = Models()

    monkeypatch.setattr(openai, "AsyncOpenAI", Client)
    adapter = OpenAICompatibleAdapter("openai", "OpenAI")

    async def collect() -> list[str]:
        return [
            chunk
            async for chunk in adapter.stream(
                "test-key",
                "gpt-5.6-luna",
                [ChatMessage(role="user", content="hello")],
                0.7,
                "high",
            )
        ]

    assert asyncio.run(collect()) == ["ok"]
    assert "temperature" not in captured
    assert captured["reasoning_effort"] == "high"
    discovered = asyncio.run(adapter.list_models("test-key"))
    assert discovered[1].reasoning_efforts == [
        "none",
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
    ]
    assert discovered[0].reasoning_efforts == []


def test_agnes_provider_uses_official_openai_compatible_endpoint() -> None:
    adapter = build_provider_registry()["agnes"]

    assert adapter.base_url == "https://apihub.agnes-ai.com/v1"  # type: ignore[attr-defined]


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


def test_gemini_requires_a_key_without_constructing_a_client() -> None:
    from backend.app.providers import GeminiAdapter

    adapter = GeminiAdapter()

    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is not configured"):
        asyncio.run(adapter.list_models(None))


def test_gemini_closes_async_clients_for_discovery_and_streaming() -> None:
    from backend.app.providers import GeminiAdapter

    closed = 0
    streams_closed = 0

    class Pager:
        def __aiter__(self):
            async def items():
                yield SimpleNamespace(
                    name="models/gemini-test",
                    supported_actions=["generateContent"],
                )

            return items()

    class Response:
        def __aiter__(self):
            async def chunks():
                yield SimpleNamespace(text="hello")

            return chunks()

        async def aclose(self):
            nonlocal streams_closed
            streams_closed += 1

    class Models:
        async def list(self):
            return Pager()

        async def generate_content_stream(self, **_kwargs):
            return Response()

    class AsyncClient:
        models = Models()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            nonlocal closed
            closed += 1

    class Client:
        aio = AsyncClient()

    adapter = GeminiAdapter()
    adapter._client = lambda _key: Client()  # type: ignore[method-assign]

    models = asyncio.run(adapter.list_models("key"))

    async def collect() -> list[str]:
        return [
            chunk
            async for chunk in adapter.stream(
                "key", "gemini-test", [ChatMessage(role="user", content="hi")], 0.7
            )
        ]

    chunks = asyncio.run(collect())

    async def cancel_after_first_chunk() -> str:
        stream = adapter.stream(
            "key", "gemini-test", [ChatMessage(role="user", content="hi")], 0.7
        )
        first = await anext(stream)
        await stream.aclose()
        return first

    first = asyncio.run(cancel_after_first_chunk())

    assert [model.id for model in models] == ["gemini-test"]
    assert chunks == ["hello"]
    assert first == "hello"
    assert closed == 3
    assert streams_closed == 2


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


def test_openrouter_models_include_live_api_pricing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    class Models:
        async def list(self):
            return SimpleNamespace(
                data=[
                    SimpleNamespace(
                        id="vendor/model",
                        model_extra={
                            "pricing": {
                                "prompt": "0.0000025",
                                "completion": "0.00001",
                            }
                        },
                    )
                ]
            )

    class Client:
        def __init__(self, **_kwargs) -> None:
            self.models = Models()

    monkeypatch.setattr(openai, "AsyncOpenAI", Client)
    adapter = OpenAICompatibleAdapter(
        "openrouter", "OpenRouter", "https://openrouter.ai/api/v1"
    )

    models = asyncio.run(adapter.list_models("test-key"))

    assert models[0].pricing
    assert models[0].pricing.input_per_million == 2.5
    assert models[0].pricing.output_per_million == 10


def test_opencode_bridge_rejects_non_loopback_urls() -> None:
    with pytest.raises(ValueError, match="loopback"):
        OpenCodeBridgeAdapter("https://example.com")
