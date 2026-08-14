from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi.testclient import TestClient


@dataclass
class FakeMcpGateway:
    discoveries: list[str] = field(default_factory=list)
    calls: list[tuple[str, str, dict[str, Any]]] = field(default_factory=list)

    async def discover(self, server: Any) -> list[dict[str, Any]]:
        self.discoveries.append(server.id)
        return [
            {
                "name": "read_document",
                "title": "Read document",
                "description": "Read one document from the approved workspace.",
                "input_schema": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                    "additionalProperties": False,
                },
            }
        ]

    async def call(
        self, server: Any, tool_name: str, arguments: dict[str, Any]
    ) -> dict[str, Any]:
        self.calls.append((server.id, tool_name, arguments))
        return {
            "content": "Document token=should-not-leak",
            "is_error": False,
        }


def make_client(gateway: FakeMcpGateway) -> TestClient:
    from backend.app.main import create_app

    return TestClient(create_app(database_url=":memory:", mcp_gateway=gateway))


def stdio_server(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/mcp/servers",
        json={
            "name": "Workspace reader",
            "transport": "stdio",
            "command": "uvx",
            "args": ["safe-reader-mcp"],
            "env_keys": ["SAFE_READER_API_KEY"],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_mcp_registration_is_inert_until_explicit_discovery() -> None:
    gateway = FakeMcpGateway()
    with make_client(gateway) as client:
        server = stdio_server(client)
        assert gateway.discoveries == []

        response = client.post(f"/api/v1/mcp/servers/{server['id']}/discover")

    assert response.status_code == 200
    assert response.json()[0]["name"] == "read_document"
    assert gateway.discoveries == [server["id"]]
    assert server["command_preview"] == "uvx safe-reader-mcp"
    assert server["env_keys"] == ["SAFE_READER_API_KEY"]


def test_tool_execution_requires_single_use_session_scoped_approval() -> None:
    gateway = FakeMcpGateway()
    with make_client(gateway) as owner:
        server = stdio_server(owner)
        owner.post(f"/api/v1/mcp/servers/{server['id']}/discover")
        queued = owner.post(
            "/api/v1/tool-requests",
            json={
                "server_id": server["id"],
                "tool_name": "read_document",
                "arguments": {"path": "notes.md", "api_token": "hidden-value"},
                "rationale": "Use the document as evidence for the answer.",
                "origin": "agent",
            },
        )
        # The tool schema rejects undeclared fields before an approval exists.
        assert queued.status_code == 422

        queued = owner.post(
            "/api/v1/tool-requests",
            json={
                "server_id": server["id"],
                "tool_name": "read_document",
                "arguments": {"path": "notes.md"},
                "rationale": "Use the document as evidence for the answer.",
                "origin": "agent",
            },
        )
        assert queued.status_code == 201
        request = queued.json()
        assert request["status"] == "pending"
        assert request["arguments"] == {"path": "notes.md"}
        assert len(request["argument_hash"]) == 64
        assert gateway.calls == []

        with make_client(gateway) as stranger:
            assert stranger.get("/api/v1/tool-requests").json() == []
            assert (
                stranger.post(
                    f"/api/v1/tool-requests/{request['id']}/approve",
                    json={"reason": "not mine"},
                ).status_code
                == 404
            )

        approved = owner.post(
            f"/api/v1/tool-requests/{request['id']}/approve",
            json={"reason": "I reviewed the exact path."},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "completed"
        assert approved.json()["arguments"] is None
        assert "should-not-leak" not in approved.json()["result_preview"]
        assert gateway.calls == [(server["id"], "read_document", {"path": "notes.md"})]

        repeated = owner.post(
            f"/api/v1/tool-requests/{request['id']}/approve",
            json={"reason": "again"},
        )
        assert repeated.status_code == 409
        assert len(gateway.calls) == 1


def test_denied_tool_request_never_executes_and_is_audited() -> None:
    gateway = FakeMcpGateway()
    with make_client(gateway) as client:
        server = stdio_server(client)
        client.post(f"/api/v1/mcp/servers/{server['id']}/discover")
        request = client.post(
            "/api/v1/tool-requests",
            json={
                "server_id": server["id"],
                "tool_name": "read_document",
                "arguments": {"path": "private.md"},
                "rationale": "Inspect private notes.",
            },
        ).json()

        denied = client.post(
            f"/api/v1/tool-requests/{request['id']}/deny",
            json={"reason": "The requested file is outside this task."},
        )
        audit = client.get("/api/v1/tool-requests").json()

    assert denied.status_code == 200
    assert denied.json()["status"] == "denied"
    assert denied.json()["arguments"] is None
    assert audit[0]["decision_reason"] == "The requested file is outside this task."
    assert gateway.calls == []


def test_mcp_configuration_rejects_shells_and_private_remote_hosts() -> None:
    gateway = FakeMcpGateway()
    with make_client(gateway) as client:
        shell = client.post(
            "/api/v1/mcp/servers",
            json={
                "name": "Shell",
                "transport": "stdio",
                "command": "powershell.exe",
                "args": ["-Command", "Get-ChildItem"],
            },
        )
        remote = client.post(
            "/api/v1/mcp/servers",
            json={
                "name": "Private endpoint",
                "transport": "streamable_http",
                "url": "https://127.0.0.1:9000/mcp",
            },
        )

    assert shell.status_code == 422
    assert remote.status_code == 422

    with make_client(gateway) as client:
        embedded_secret = client.post(
            "/api/v1/mcp/servers",
            json={
                "name": "Leaky arguments",
                "transport": "stdio",
                "command": "uvx",
                "args": ["example-mcp", "--api-key", "do-not-store-this"],
            },
        )
    assert embedded_secret.status_code == 422
