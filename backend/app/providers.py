from __future__ import annotations

import asyncio
import os
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable
from typing import Any

from backend.app.contracts import ChatMessage, ModelDescriptor, ProviderDiscovery


class ProviderAdapter(ABC):
    id: str
    label: str

    @abstractmethod
    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]: ...

    @abstractmethod
    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        if False:
            yield ""


class OpenAICompatibleAdapter(ProviderAdapter):
    def __init__(self, provider_id: str, label: str, base_url: str | None = None) -> None:
        self.id, self.label, self.base_url = provider_id, label, base_url

    def _client(self, api_key: str | None):
        from openai import AsyncOpenAI

        return AsyncOpenAI(api_key=api_key or "not-required", base_url=self.base_url)

    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]:
        page = await self._client(api_key).models.list()
        return sorted(
            [ModelDescriptor(provider=self.id, id=item.id) for item in page.data],
            key=lambda item: item.id,
        )

    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        response = await self._client(api_key).chat.completions.create(
            model=model,
            messages=[message.model_dump() for message in messages],
            temperature=temperature,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices and (delta := chunk.choices[0].delta.content):
                yield delta


class OllamaAdapter(ProviderAdapter):
    id, label = "ollama", "Ollama"

    @staticmethod
    def _client(api_key: str | None):
        from ollama import AsyncClient

        headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
        return AsyncClient(host=os.getenv("CHAT_OLLAMA_HOST", "http://localhost:11434"), headers=headers)

    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]:
        response = await self._client(api_key).list()
        models = response.models if hasattr(response, "models") else response.get("models", [])
        return [
            ModelDescriptor(provider=self.id, id=getattr(item, "model", None) or item["model"])
            for item in models
        ]

    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        response = await self._client(api_key).chat(
            model=model,
            messages=[message.model_dump() for message in messages],
            options={"temperature": temperature},
            stream=True,
        )
        async for chunk in response:
            message = chunk.message if hasattr(chunk, "message") else chunk["message"]
            content = message.content if hasattr(message, "content") else message.get("content", "")
            if content:
                yield content


class AnthropicAdapter(ProviderAdapter):
    id, label = "anthropic", "Anthropic"

    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]:
        from anthropic import AsyncAnthropic

        page = await AsyncAnthropic(api_key=api_key).models.list()
        return [ModelDescriptor(provider=self.id, id=item.id, capabilities=["vision"]) for item in page.data]

    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        from anthropic import AsyncAnthropic

        system = "\n\n".join(message.content for message in messages if message.role == "system")
        chat = [message.model_dump() for message in messages if message.role in {"user", "assistant"}]
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": chat,
            "max_tokens": 4096,
            "temperature": temperature,
        }
        if system:
            kwargs["system"] = system
        async with AsyncAnthropic(api_key=api_key).messages.stream(**kwargs) as response:
            async for text in response.text_stream:
                yield text


class GeminiAdapter(ProviderAdapter):
    id, label = "gemini", "Google Gemini"

    @staticmethod
    def _client(api_key: str | None):
        from google import genai

        return genai.Client(api_key=api_key)

    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]:
        pager = await self._client(api_key).aio.models.list()
        return [
            ModelDescriptor(provider=self.id, id=item.name.removeprefix("models/"))
            async for item in pager
            if "generateContent" in (item.supported_actions or [])
        ]

    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        prompt = "\n\n".join(f"{item.role}: {item.content}" for item in messages)
        response = await self._client(api_key).aio.models.generate_content_stream(
            model=model, contents=prompt, config={"temperature": temperature}
        )
        async for chunk in response:
            if chunk.text:
                yield chunk.text


class ProviderRegistry:
    def __init__(self, adapters: dict[str, ProviderAdapter]) -> None:
        self.adapters = adapters

    def __getitem__(self, provider: str) -> ProviderAdapter:
        return self.adapters[provider]

    async def discover_models(
        self, credential: Callable[[str], str | None]
    ) -> dict[str, ProviderDiscovery]:
        async def discover(provider: str, adapter: ProviderAdapter) -> ProviderDiscovery:
            try:
                return ProviderDiscovery(
                    provider=provider, models=await adapter.list_models(credential(provider))
                )
            except Exception as exc:
                return ProviderDiscovery(provider=provider, error=str(exc))

        results = await asyncio.gather(
            *(discover(provider, adapter) for provider, adapter in self.adapters.items())
        )
        return {result.provider: result for result in results}


def build_provider_registry() -> dict[str, ProviderAdapter]:
    return {
        "ollama": OllamaAdapter(),
        "openai": OpenAICompatibleAdapter("openai", "OpenAI"),
        "anthropic": AnthropicAdapter(),
        "gemini": GeminiAdapter(),
        "openrouter": OpenAICompatibleAdapter(
            "openrouter", "OpenRouter", "https://openrouter.ai/api/v1"
        ),
        "xai": OpenAICompatibleAdapter("xai", "xAI (Grok)", "https://api.x.ai/v1"),
        "omniroute": OpenAICompatibleAdapter(
            "omniroute",
            "OmniRoute",
            os.getenv("OMNIROUTE_BASE_URL", "http://localhost:8082/v1"),
        ),
    }
