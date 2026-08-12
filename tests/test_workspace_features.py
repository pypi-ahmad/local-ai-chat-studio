from __future__ import annotations

import json

from fastapi.testclient import TestClient


def _conversation(client: TestClient) -> str:
    response = client.post("/api/v1/conversations", json={"title": "Workspace"})
    assert response.status_code == 201
    return response.json()["id"]


def _complete_echo_run(client: TestClient, conversation_id: str, content: str = "hello") -> str:
    preflight = client.post(
        f"/api/v1/conversations/{conversation_id}/turns/preflight",
        json={"provider": "echo", "model": "deterministic", "content": content},
    )
    assert preflight.status_code == 200
    plan = preflight.json()
    created = client.post(
        f"/api/v1/conversations/{conversation_id}/turns",
        json={
            "provider": "echo",
            "model": "deterministic",
            "content": content,
            "plan_hash": plan["plan_hash"],
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
    assert events[-1]["type"] == "run.completed"
    return run_id


def test_run_is_owned_by_browser_session(client: TestClient) -> None:
    run_id = _complete_echo_run(client, _conversation(client))
    other = TestClient(client.app)

    assert other.get(f"/api/v1/runs/{run_id}").status_code == 404
    assert other.get(f"/api/v1/runs/{run_id}/events").status_code == 404
    assert other.delete(f"/api/v1/runs/{run_id}").status_code == 404


def test_cloud_preflight_warns_about_secrets_and_excludes_private_context(
    client: TestClient,
) -> None:
    conversation_id = _conversation(client)
    response = client.post(
        f"/api/v1/conversations/{conversation_id}/turns/preflight",
        json={
            "provider": "openai",
            "model": "gpt-test",
            "content": "Use sk-1234567890abcdef but do not print it",
            "include_memory": True,
            "include_retrieval": True,
        },
    )

    assert response.status_code == 200
    plan = response.json()
    assert plan["requires_confirmation"] is True
    assert {finding["category"] for finding in plan["findings"]} == {"secret"}
    assert all("1234567890abcdef" not in finding["preview"] for finding in plan["findings"])
    sections = {section["kind"]: section for section in plan["sections"]}
    assert sections["memory"]["included"] is False
    assert sections["history"]["included"] is False


def test_turn_persists_messages_context_and_replay_bundle(client: TestClient) -> None:
    conversation_id = _conversation(client)
    run_id = _complete_echo_run(client, conversation_id, "repeat this")

    conversation = client.get(f"/api/v1/conversations/{conversation_id}").json()
    assert [item["content"] for item in conversation["messages"]] == [
        "repeat this",
        "repeat this",
    ]
    bundle = client.get(f"/api/v1/runs/{run_id}/bundle").json()
    assert bundle["version"] == 1
    assert bundle["run"]["output"] == "repeat this"
    assert bundle["integrity"]["hash"]


def test_branch_backpack_focus_and_provider_policy(client: TestClient) -> None:
    conversation_id = _conversation(client)
    client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"role": "user", "content": "first"},
    )
    message = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"role": "assistant", "content": "second"},
    ).json()

    branch = client.post(
        f"/api/v1/conversations/{conversation_id}/branch",
        json={"message_id": message["id"], "title": "Branch"},
    )
    assert [item["content"] for item in branch.json()["messages"]] == ["first", "second"]

    backpack = client.post(
        "/api/v1/backpacks",
        json={"name": "Project facts", "items": [{"title": "Constraint", "content": "Local only"}]},
    )
    assert backpack.status_code == 201
    assert backpack.json()["items"][0]["content"] == "Local only"

    focus = client.post(
        "/api/v1/focus-sessions",
        json={
            "conversation_id": conversation_id,
            "objective": "Ship safely",
            "success_criteria": "All checks pass",
            "constraints": ["No secrets"],
        },
    )
    assert focus.status_code == 201
    assert focus.json()["status"] == "active"

    policy = client.put(
        "/api/v1/providers/openai/policy",
        json={"allow_memory": True, "allow_retrieval": False, "allow_attachments": False, "allow_web": False, "allow_backpacks": False},
    )
    assert policy.status_code == 200
    assert policy.json()["allow_memory"] is True


def test_memory_preset_upload_activity_and_replay(client: TestClient) -> None:
    conversation_id = _conversation(client)
    memory = client.post(
        "/api/v1/memories",
        json={"content": "Prefers concise answers", "category": "preference"},
    )
    assert memory.status_code == 201
    assert client.get("/api/v1/memories").json()[0]["status"] == "active"

    preset = client.post(
        "/api/v1/presets",
        json={
            "name": "Reviewer",
            "system_prompt": "Review carefully",
            "model_key": "echo::deterministic",
            "temperature": 0.2,
        },
    )
    assert preset.status_code == 201
    assert client.get("/api/v1/presets").json()[0]["name"] == "Reviewer"

    upload = client.post(
        "/api/v1/uploads",
        json={
            "conversation_id": conversation_id,
            "filename": "notes.txt",
            "content_base64": "TG9jYWwgY29udGV4dCBvbmx5",
        },
    )
    assert upload.status_code == 201
    assert upload.json()["text_preview"] == "Local context only"

    run_id = _complete_echo_run(client, conversation_id, "original answer")
    activity = client.get("/api/v1/activity").json()
    assert activity[0]["id"] == run_id

    replay = client.post(
        f"/api/v1/runs/{run_id}/replay",
        json={"provider": "echo", "model": "deterministic"},
    )
    assert replay.status_code == 202
    replay_id = replay.json()["id"]
    with client.stream("GET", f"/api/v1/runs/{replay_id}/events") as stream:
        list(stream.iter_lines())
    diff = client.get(f"/api/v1/runs/{run_id}/diff/{replay_id}")
    assert diff.status_code == 200
    assert diff.json()["changed"] is False
