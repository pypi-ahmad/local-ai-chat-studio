from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import re
import socket
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlsplit

import httpx2
from mcp import Client, ClientSession
from mcp.client.stdio import StdioServerParameters
from mcp.client.streamable_http import streamable_http_client

from backend.app.contracts import McpServer
class McpGateway(Protocol):
    async def discover(self, server: McpServer) -> list[dict[str, Any]]: ...

    async def call(
        self, server: McpServer, tool_name: str, arguments: dict[str, Any]
    ) -> dict[str, Any]: ...


SENSITIVE_KEY = re.compile(
    r"(?:authorization|cookie|credential|password|secret|token|api[_-]?key)", re.I
)
INLINE_SECRET = re.compile(
    r"(?i)\b(password|secret|token|api[_-]?key|authorization)\s*[:=]\s*([^\s,;]+)"
)
TOKEN_SECRET = re.compile(
    r"\b(?:sk|sk-ant)-[A-Za-z0-9_-]{12,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b",
    re.I,
)


def redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): "[REDACTED]" if SENSITIVE_KEY.search(str(key)) else redact_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, str):
        return INLINE_SECRET.sub(r"\1=[REDACTED]", TOKEN_SECRET.sub("[REDACTED]", value))
    return value


def safe_result_preview(result: dict[str, Any], limit: int = 12_000) -> str:
    content = result.get("content", "")
    text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
    text = redact_value(text)
    return str(text)[:limit]


def _public_remote_url(url: str) -> None:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Remote MCP servers require an HTTPS URL")
    try:
        addresses = {
            item[4][0]
            for item in socket.getaddrinfo(parsed.hostname, parsed.port or 443)
        }
    except OSError as exc:
        raise ValueError("Remote MCP hostname could not be resolved") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise ValueError("Remote MCP hostname resolves to a private or reserved address")


class DefaultMcpGateway:
    def __init__(self, sandbox_root: Path) -> None:
        self.sandbox_root = sandbox_root

    def _stdio_client(self, server: McpServer) -> Client:
        workspace = self.sandbox_root / server.id
        workspace.mkdir(parents=True, exist_ok=True)
        inherited = {"PATH", "PATHEXT", "SYSTEMROOT", "WINDIR"}
        allowed = inherited | set(server.env_keys)
        environment = {key: os.environ[key] for key in allowed if key in os.environ}
        parameters = StdioServerParameters(
            command=server.command or "",
            args=server.args,
            env=environment,
            cwd=workspace,
        )
        return Client(parameters, read_timeout_seconds=30)

    @asynccontextmanager
    async def _session(self, server: McpServer):
        if server.transport == "stdio":
            async with self._stdio_client(server) as client:
                yield client
            return

        await asyncio.to_thread(_public_remote_url, server.url or "")
        timeout = httpx2.Timeout(30, read=30)
        async with httpx2.AsyncClient(follow_redirects=False, timeout=timeout) as http:
            async with streamable_http_client(
                server.url or "", http_client=http
            ) as streams:
                read_stream, write_stream, _ = streams
                async with ClientSession(
                    read_stream, write_stream, read_timeout_seconds=30
                ) as session:
                    await session.initialize()
                    yield session

    async def discover(self, server: McpServer) -> list[dict[str, Any]]:
        async with asyncio.timeout(30), self._session(server) as session:
            result = await session.list_tools()
        return [
            {
                "name": tool.name,
                "title": tool.title,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in result.tools
        ]

    async def call(
        self, server: McpServer, tool_name: str, arguments: dict[str, Any]
    ) -> dict[str, Any]:
        async with asyncio.timeout(30), self._session(server) as session:
            result = await session.call_tool(
                tool_name,
                arguments,
                read_timeout_seconds=30,
            )
        blocks = [item.model_dump(mode="json", by_alias=True) for item in result.content]
        return {
            "content": blocks,
            "structured_content": result.structured_content,
            "is_error": result.is_error,
        }
