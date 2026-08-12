from __future__ import annotations

import asyncio
import base64
import json
import os
from contextlib import suppress
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable
from typing import Any
from urllib.parse import urlparse

import httpx

from backend.app.contracts import ChatMessage, ModelDescriptor, ProviderDiscovery


class ProviderAdapter(ABC):
    id: str
    label: str
    auth_modes: tuple[str, ...] = ("api_key",)
    local = False

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
    def __init__(
        self, provider_id: str, label: str, base_url: str | None = None
    ) -> None:
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
        formatted = []
        for message in messages:
            if message.images:
                content: Any = [{"type": "text", "text": message.content}]
                content.extend(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{image.mime};base64,{image.data_base64}"
                        },
                    }
                    for image in message.images
                )
                formatted.append({"role": message.role, "content": content})
            else:
                formatted.append(message.model_dump(exclude={"images"}))
        response = await self._client(api_key).chat.completions.create(
            model=model,
            messages=formatted,
            temperature=temperature,
            stream=True,
        )
        # async with releases the underlying HTTP connection on early exit
        # (cancellation), not just when the stream is fully consumed.
        async with response:
            async for chunk in response:
                if chunk.choices and (delta := chunk.choices[0].delta.content):
                    yield delta


class OllamaAdapter(ProviderAdapter):
    def __init__(self, provider_id: str, label: str, host: str, *, cloud: bool) -> None:
        self.id, self.label, self.host, self.cloud = provider_id, label, host, cloud
        self.auth_modes = ("api_key",) if cloud else ("none",)
        self.local = not cloud

    def _client(self, api_key: str | None):
        from ollama import AsyncClient

        headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
        return AsyncClient(host=self.host, headers=headers)

    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]:
        response = await self._client(api_key).list()
        models = (
            response.models
            if hasattr(response, "models")
            else response.get("models", [])
        )
        descriptors = []
        for item in models:
            model_id = getattr(item, "model", None) or item["model"]
            if not self.cloud and model_id.endswith("-cloud"):
                continue
            capabilities: list[str] = []
            try:
                details = await self._client(api_key).show(model_id)
                raw = getattr(details, "capabilities", None) or details.get(
                    "capabilities", []
                )
                if "vision" in raw:
                    capabilities.append("vision")
            except Exception:
                pass
            descriptors.append(
                ModelDescriptor(
                    provider=self.id, id=model_id, capabilities=capabilities
                )
            )
        return descriptors

    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        response = await self._client(api_key).chat(
            model=model,
            messages=[
                {
                    **message.model_dump(exclude={"images"}),
                    **(
                        {
                            "images": [
                                base64.b64decode(image.data_base64)
                                for image in message.images
                            ]
                        }
                        if message.images
                        else {}
                    ),
                }
                for message in messages
            ],
            options={"temperature": temperature},
            stream=True,
        )
        try:
            async for chunk in response:
                message = (
                    chunk.message if hasattr(chunk, "message") else chunk["message"]
                )
                content = (
                    message.content
                    if hasattr(message, "content")
                    else message.get("content", "")
                )
                if content:
                    yield content
        finally:
            # response is an async generator; aclose() on early exit (cancellation)
            # lets its own internal cleanup close the underlying HTTP stream.
            await response.aclose()


class AnthropicAdapter(ProviderAdapter):
    id, label = "anthropic", "Anthropic"
    auth_modes = ("api_key", "wif")

    @staticmethod
    def _client(api_key: str | None):
        from anthropic import AsyncAnthropic

        return AsyncAnthropic(api_key=api_key) if api_key else AsyncAnthropic()

    async def list_models(self, api_key: str | None) -> list[ModelDescriptor]:
        page = await self._client(api_key).models.list()
        return [
            ModelDescriptor(provider=self.id, id=item.id, capabilities=["vision"])
            for item in page.data
        ]

    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        system = "\n\n".join(
            message.content for message in messages if message.role == "system"
        )
        chat = []
        for message in messages:
            if message.role not in {"user", "assistant"}:
                continue
            if message.images:
                content: Any = [{"type": "text", "text": message.content}]
                content.extend(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image.mime,
                            "data": image.data_base64,
                        },
                    }
                    for image in message.images
                )
                chat.append({"role": message.role, "content": content})
            else:
                chat.append(message.model_dump(exclude={"images"}))
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": chat,
            "max_tokens": 4096,
            "temperature": temperature,
        }
        if system:
            kwargs["system"] = system
        async with self._client(api_key).messages.stream(**kwargs) as response:
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
        contents: list[Any] = [prompt]
        from google.genai import types

        contents.extend(
            types.Part.from_bytes(
                data=base64.b64decode(image.data_base64), mime_type=image.mime
            )
            for message in messages
            for image in message.images
        )
        response = await self._client(api_key).aio.models.generate_content_stream(
            model=model, contents=contents, config={"temperature": temperature}
        )
        try:
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
        finally:
            # response is an async generator; aclose() on early exit (cancellation)
            # lets its own internal cleanup close the underlying HTTP stream.
            await response.aclose()


class OpenCodeZenAdapter(OpenAICompatibleAdapter):
    """OpenCode Zen exposes several model families through their native protocols."""

    def __init__(self) -> None:
        super().__init__("opencode-zen", "OpenCode Zen", "https://opencode.ai/zen/v1")

    async def stream(
        self,
        api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        if model.startswith("gpt-"):
            formatted = []
            for message in messages:
                if message.images:
                    content: Any = [{"type": "input_text", "text": message.content}]
                    content.extend(
                        {
                            "type": "input_image",
                            "image_url": f"data:{image.mime};base64,{image.data_base64}",
                        }
                        for image in message.images
                    )
                    formatted.append({"role": message.role, "content": content})
                else:
                    formatted.append(message.model_dump(exclude={"images"}))
            response = await self._client(api_key).responses.create(
                model=model, input=formatted, temperature=temperature, stream=True
            )
            async for event in response:
                if event.type == "response.output_text.delta":
                    yield event.delta
            return
        if model.startswith(("claude-", "qwen")):
            from anthropic import AsyncAnthropic

            system = "\n\n".join(
                item.content for item in messages if item.role == "system"
            )
            chat = []
            for item in messages:
                if item.role not in {"user", "assistant"}:
                    continue
                if item.images:
                    content = [{"type": "text", "text": item.content}]
                    content.extend(
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": image.mime,
                                "data": image.data_base64,
                            },
                        }
                        for image in item.images
                    )
                    chat.append({"role": item.role, "content": content})
                else:
                    chat.append(item.model_dump(exclude={"images"}))
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": chat,
                "max_tokens": 4096,
                "temperature": temperature,
            }
            if system:
                kwargs["system"] = system
            async with AsyncAnthropic(
                api_key=api_key, base_url="https://opencode.ai/zen"
            ).messages.stream(**kwargs) as response:
                async for text in response.text_stream:
                    yield text
            return
        if model.startswith("gemini-"):
            prompt = "\n\n".join(f"{item.role}: {item.content}" for item in messages)
            parts: list[dict[str, Any]] = [{"text": prompt}]
            parts.extend(
                {
                    "inlineData": {
                        "mimeType": image.mime,
                        "data": image.data_base64,
                    }
                }
                for message in messages
                for image in message.images
            )
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"https://opencode.ai/zen/v1/models/{model}:streamGenerateContent",
                    headers={"Authorization": f"Bearer {api_key}"},
                    params={"alt": "sse"},
                    json={
                        "contents": [{"role": "user", "parts": parts}],
                        "generationConfig": {"temperature": temperature},
                    },
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        payload = json.loads(line[6:])
                        for candidate in payload.get("candidates", []):
                            for part in candidate.get("content", {}).get("parts", []):
                                if text := part.get("text"):
                                    yield text
            return
        async for text in super().stream(api_key, model, messages, temperature):
            yield text


class OpenCodeBridgeAdapter(ProviderAdapter):
    id, label = "opencode-bridge", "OpenCode OAuth Bridge"
    auth_modes = ("opencode_oauth",)
    # The bridge process is local, but connected providers can transmit data remotely.
    local = False

    def __init__(self, url: str | None = None) -> None:
        self.url = (
            url or os.getenv("OPENCODE_SERVER_URL", "http://127.0.0.1:4096")
        ).rstrip("/")
        parsed = urlparse(self.url)
        if parsed.scheme != "http" or parsed.hostname not in {
            "127.0.0.1",
            "localhost",
            "::1",
        }:
            raise ValueError("OPENCODE_SERVER_URL must be an HTTP loopback URL")

    def _client(self, *, timeout: float | None = 30) -> httpx.AsyncClient:
        username = os.getenv("OPENCODE_SERVER_USERNAME", "opencode")
        password = os.getenv("OPENCODE_SERVER_PASSWORD")
        auth = (username, password) if password else None
        return httpx.AsyncClient(base_url=self.url, auth=auth, timeout=timeout)

    async def health(self) -> dict[str, Any]:
        async with self._client() as client:
            response = await client.get("/global/health")
            response.raise_for_status()
            return response.json()

    async def oauth_methods(self) -> dict[str, list[dict[str, str]]]:
        async with self._client() as client:
            response = await client.get("/provider/auth")
            response.raise_for_status()
            return response.json()

    async def oauth_authorize(self, provider: str, method: int) -> dict[str, str]:
        async with self._client() as client:
            response = await client.post(
                f"/provider/{provider}/oauth/authorize", json={"method": method}
            )
            response.raise_for_status()
            return response.json()

    async def oauth_complete(
        self, provider: str, method: int, code: str | None
    ) -> bool:
        async with self._client() as client:
            response = await client.post(
                f"/provider/{provider}/oauth/callback",
                json={"method": method, **({"code": code} if code else {})},
            )
            response.raise_for_status()
            return bool(response.json())

    async def list_models(self, _api_key: str | None) -> list[ModelDescriptor]:
        async with self._client() as client:
            response = await client.get("/provider")
            response.raise_for_status()
            payload = response.json()
        connected = set(payload.get("connected", []))
        result: list[ModelDescriptor] = []
        for provider in payload.get("all", []):
            provider_id = provider.get("id", "")
            if provider_id not in connected:
                continue
            for model_id, model in provider.get("models", {}).items():
                capabilities = model.get("capabilities", {})
                inputs = capabilities.get("input", {})
                modalities = model.get("modalities", {}).get("input", [])
                vision = bool(inputs.get("image") or "image" in modalities)
                result.append(
                    ModelDescriptor(
                        provider=self.id,
                        id=f"{provider_id}/{model_id}",
                        label=f"{model.get('name') or model_id} · {provider.get('name') or provider_id}",
                        context_length=model.get("limit", {}).get("context"),
                        capabilities=["vision"] if vision else [],
                    )
                )
        return sorted(result, key=lambda item: item.id)

    async def stream(
        self,
        _api_key: str | None,
        model: str,
        messages: list[ChatMessage],
        temperature: float,
    ) -> AsyncIterator[str]:
        if "/" not in model:
            raise ValueError("OpenCode model must be '<provider>/<model>'")
        provider_id, model_id = model.split("/", 1)
        prior = messages[:-1]
        current = messages[-1]
        system = "\n\n".join(f"{item.role}: {item.content}" for item in prior)
        parts: list[dict[str, Any]] = [{"type": "text", "text": current.content}]
        parts.extend(
            {
                "type": "file",
                "mime": image.mime,
                "filename": "attachment",
                "url": f"data:{image.mime};base64,{image.data_base64}",
            }
            for image in current.images
        )
        async with self._client(timeout=None) as client:
            created = await client.post(
                "/session", json={"title": "Local AI Chat Studio run"}
            )
            created.raise_for_status()
            session_id = created.json()["id"]
            try:
                tool_response = await client.get("/experimental/tool/ids")
                tool_ids = tool_response.json() if tool_response.is_success else []
                async with client.stream("GET", "/event") as events:
                    events.raise_for_status()
                    submitted = await client.post(
                        f"/session/{session_id}/prompt_async",
                        json={
                            "model": {"providerID": provider_id, "modelID": model_id},
                            "system": system or None,
                            "tools": {tool_id: False for tool_id in tool_ids},
                            "parts": parts,
                        },
                    )
                    submitted.raise_for_status()
                    async for line in events.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        event = json.loads(line[6:])
                        event = event.get("payload", event)
                        kind = event.get("type")
                        properties = event.get("properties", {})
                        part = properties.get("part", {})
                        event_session = properties.get("sessionID") or part.get(
                            "sessionID"
                        )
                        if event_session != session_id:
                            continue
                        if (
                            kind == "message.part.updated"
                            and part.get("type") == "text"
                        ):
                            if delta := properties.get("delta"):
                                yield delta
                        elif kind == "session.error":
                            raise RuntimeError("OpenCode provider request failed")
                        elif kind == "session.idle":
                            break
            finally:
                with suppress(httpx.HTTPError):
                    await client.post(f"/session/{session_id}/abort")
                with suppress(httpx.HTTPError):
                    await client.delete(f"/session/{session_id}")


class ProviderRegistry:
    def __init__(self, adapters: dict[str, ProviderAdapter]) -> None:
        self.adapters = adapters
        self._models: dict[tuple[str, str], ModelDescriptor] = {}

    def __getitem__(self, provider: str) -> ProviderAdapter:
        return self.adapters[provider]

    async def discover_models(
        self, credential: Callable[[str], str | None]
    ) -> dict[str, ProviderDiscovery]:
        async def discover(
            provider: str, adapter: ProviderAdapter
        ) -> ProviderDiscovery:
            try:
                models = await adapter.list_models(credential(provider))
                self._models.update({(provider, model.id): model for model in models})
                return ProviderDiscovery(provider=provider, models=models)
            except Exception as exc:
                return ProviderDiscovery(provider=provider, error=str(exc))

        results = await asyncio.gather(
            *(
                discover(provider, adapter)
                for provider, adapter in self.adapters.items()
            )
        )
        return {result.provider: result for result in results}

    def supports_images(self, provider: str, model: str) -> bool | None:
        descriptor = self._models.get((provider, model))
        return "vision" in descriptor.capabilities if descriptor else None


def build_provider_registry() -> dict[str, ProviderAdapter]:
    return {
        "ollama-local": OllamaAdapter(
            "ollama-local",
            "Ollama Local",
            os.getenv("CHAT_OLLAMA_HOST", "http://localhost:11434"),
            cloud=False,
        ),
        "ollama-cloud": OllamaAdapter(
            "ollama-cloud", "Ollama Cloud", "https://ollama.com", cloud=True
        ),
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
        "opencode-bridge": OpenCodeBridgeAdapter(),
        "opencode-zen": OpenCodeZenAdapter(),
        "opencode-go": OpenAICompatibleAdapter(
            "opencode-go", "OpenCode Go", "https://opencode.ai/zen/go/v1"
        ),
    }
