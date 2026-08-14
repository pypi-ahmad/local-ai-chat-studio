from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_spa_static_files_falls_back_to_index_for_browser_routes(tmp_path) -> None:
    from backend.app.main import SPAStaticFiles

    (tmp_path / "index.html").write_text("<main>studio</main>", encoding="utf-8")
    (tmp_path / "asset.js").write_text("console.log('studio')", encoding="utf-8")
    app = FastAPI()
    app.mount("/", SPAStaticFiles(directory=tmp_path, html=True), name="frontend")

    with TestClient(app) as spa:
        route = spa.get("/chat/conversation-1", headers={"Accept": "text/html"})
        asset = spa.get("/missing.js")

    assert route.status_code == 200
    assert "studio" in route.text
    assert asset.status_code == 404


def test_health_and_session_cookie(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "2"}
    assert response.cookies.get("chat_session")


def test_managed_server_can_be_stopped_from_the_local_ui() -> None:
    from backend.app.main import create_app

    shutdown = Mock()
    with TestClient(
        create_app(database_url=":memory:", shutdown_callback=shutdown)
    ) as client:
        response = client.post(
            "/api/v1/runtime/shutdown",
            headers={"X-Local-Studio": "shutdown"},
        )

    assert response.status_code == 202
    assert response.json() == {"status": "stopping"}
    shutdown.assert_called_once_with()


def test_shutdown_rejects_cross_site_and_unmanaged_requests(client: TestClient) -> None:
    assert client.post("/api/v1/runtime/shutdown").status_code == 403
    assert (
        client.post(
            "/api/v1/runtime/shutdown",
            headers={"X-Local-Studio": "shutdown"},
        ).status_code
        == 503
    )


def test_conversation_crud_preserves_message_order(client: TestClient) -> None:
    created = client.post("/api/v1/conversations", json={"title": "TDD chat"})
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    first = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"role": "user", "content": "first"},
    )
    second = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"role": "assistant", "content": "second"},
    )

    assert first.status_code == second.status_code == 201
    detail = client.get(f"/api/v1/conversations/{conversation_id}")
    assert [message["content"] for message in detail.json()["messages"]] == [
        "first",
        "second",
    ]


def test_conversation_settings_are_saved_independently(client: TestClient) -> None:
    first = client.post("/api/v1/conversations", json={"title": "First"}).json()
    second = client.post("/api/v1/conversations", json={"title": "Second"}).json()
    settings = {
        "model_key": "openai::gpt-5.6",
        "reasoning_effort": "high",
        "temperature": 0.3,
        "context_policy": "files",
        "include_web": True,
        "auto_compress_history": True,
        "system_prompt": "Answer as a careful reviewer.",
        "layout": "compact",
    }

    updated = client.patch(
        f"/api/v1/conversations/{first['id']}", json={"settings": settings}
    )

    assert updated.status_code == 200
    assert updated.json()["settings"] == settings
    assert client.get(f"/api/v1/conversations/{first['id']}").json()[
        "settings"
    ] == settings
    assert client.get(f"/api/v1/conversations/{second['id']}").json()[
        "settings"
    ] != settings


def test_conversation_can_start_with_assistant_settings(client: TestClient) -> None:
    settings = {
        "model_key": "openai::gpt-5.6-luna",
        "reasoning_effort": None,
        "temperature": 0.2,
        "context_policy": "full",
        "include_web": False,
        "auto_compress_history": False,
        "system_prompt": "Review code for correctness and explain each finding.",
        "layout": "conversation",
    }

    created = client.post(
        "/api/v1/conversations",
        json={"title": "Code reviewer", "settings": settings},
    )

    assert created.status_code == 201
    assert created.json()["title"] == "Code reviewer"
    assert created.json()["settings"] == settings


def test_provider_secret_is_scoped_to_browser_session(client: TestClient) -> None:
    connected = client.put(
        "/api/v1/providers/openai/credential", json={"api_key": "sk-test"}
    )
    assert connected.status_code == 204
    providers = client.get("/api/v1/providers").json()["providers"]
    assert (
        next(item for item in providers if item["id"] == "openai")["key_source"]
        == "session"
    )

    isolated = TestClient(client.app)
    providers = isolated.get("/api/v1/providers").json()["providers"]
    assert (
        next(item for item in providers if item["id"] == "openai")["key_source"]
        != "session"
    )


def test_anthropic_reports_workload_identity_source(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_PROFILE", "test-profile")

    providers = client.get("/api/v1/providers").json()["providers"]

    assert (
        next(item for item in providers if item["id"] == "anthropic")["key_source"]
        == "wif"
    )


def test_run_stream_contract_retains_completed_output(client: TestClient) -> None:
    created = client.post(
        "/api/v1/runs",
        json={
            "provider": "echo",
            "model": "deterministic",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )
    assert created.status_code == 202
    run_id = created.json()["id"]

    with client.stream("GET", f"/api/v1/runs/{run_id}/events") as stream:
        events = [
            json.loads(line.removeprefix("data: "))
            for line in stream.iter_lines()
            if line.startswith("data: ")
        ]

    assert events[0]["type"] == "run.started"
    assert any(event["type"] == "run.delta" for event in events)
    assert events[-1]["type"] == "run.completed"
    snapshot = client.get(f"/api/v1/runs/{run_id}").json()
    assert snapshot["status"] == "completed"
    assert snapshot["output"] == "hello"


def test_openrouter_auth_uses_session_pkce_and_current_callback_origin(
    client: TestClient,
) -> None:
    response = client.post("/api/v1/providers/openrouter/auth/start")

    assert response.status_code == 200
    payload = response.json()
    parsed = urlparse(payload["authorization_url"])
    query = parse_qs(parsed.query)
    assert parsed.netloc == "openrouter.ai"
    assert query["code_challenge_method"] == ["S256"]
    assert query["callback_url"] == [
        "http://testserver/api/v1/providers/openrouter/auth/callback"
    ]
    assert len(query["code_challenge"][0]) >= 43
