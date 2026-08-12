from __future__ import annotations

import base64
import asyncio
import binascii
import difflib
import hashlib
import json
import os
import secrets
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlencode

import httpx

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import PlainTextResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.app.contracts import (
    Backpack,
    BackpackCreate,
    Conversation,
    ConversationBranch,
    ConversationCreate,
    ConversationUpdate,
    ContextPlan,
    CredentialInput,
    DataImport,
    FeedbackInput,
    FocusCreate,
    FocusSession,
    FocusUpdate,
    Memory,
    MemoryCreate,
    MemoryUpdate,
    Message,
    MessageCreate,
    OAuthCodeInput,
    Preset,
    PresetCreate,
    Profile,
    ProviderPolicy,
    ProviderSimulationInput,
    ReplayBundle,
    ReplayCreate,
    RunCreate,
    RunSnapshot,
    SafetyText,
    TurnCreate,
    TurnPreflight,
    Upload,
    UploadCreate,
    V2ImportRequest,
    WipeRequest,
)
from backend.app.runs import RunManager
from backend.app.providers import ProviderRegistry, build_provider_registry
from backend.app.sessions import PROVIDER_ENV, SessionVault
from backend.app.store import Store
from backend.app.workspace import (
    assemble_messages,
    build_context_plan,
    sanitize_text,
    scan_text,
    search_web,
)
from src.files import ACCEPTED_TYPES, parse_upload
from src.ollama_client import ollama_alive, running_models


def create_app(
    database_url: str | None = None,
    provider_registry: ProviderRegistry | None = None,
    v2_database_url: str | None = None,
) -> FastAPI:
    data_dir = Path(os.getenv("CHAT_DATA_DIR", "data"))
    store = Store(database_url or str(data_dir / "app.db"))
    v2_database = v2_database_url or str(data_dir / "v2" / "studio.db")
    vault = SessionVault()
    OAUTH_VERIFIER_TTL = 600  # seconds; abandoned flows are pruned, not kept forever
    oauth_verifiers: dict[str, tuple[str, float]] = {}
    registry = provider_registry or ProviderRegistry(build_provider_registry())
    # Adapter ids are the single source of truth for provider identity; every id
    # must also have a credential-env entry, or credential routes 404 for a
    # provider that's otherwise live — fail fast at startup, not on first request.
    missing_env = set(registry.adapters) - set(PROVIDER_ENV)
    if missing_env:
        raise RuntimeError(f"Providers missing from PROVIDER_ENV: {sorted(missing_env)}")
    runs = RunManager(registry, vault, store)
    web_by_plan: dict[str, list[dict[str, str]]] = {}

    async def context_plan(
        conversation_id: str, payload: TurnPreflight
    ) -> ContextPlan:
        provisional = build_context_plan(store, conversation_id, payload)
        web_enabled = any(
            section.kind == "web" and section.included for section in provisional.sections
        )
        results = (
            await asyncio.to_thread(search_web, payload.content) if web_enabled else []
        )
        plan = build_context_plan(store, conversation_id, payload, results)
        if len(web_by_plan) >= 128:
            web_by_plan.pop(next(iter(web_by_plan)))
        web_by_plan[plan.plan_hash] = results
        return plan

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        store.connection.close()

    app = FastAPI(title="Local AI Chat Studio API", version="2.0.0", lifespan=lifespan)
    app.state.store, app.state.vault, app.state.runs = store, vault, runs
    app.state.providers = registry

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.middleware("http")
    async def session_cookie(request: Request, call_next):
        session_id = request.cookies.get("chat_session") or vault.new_id()
        request.state.session_id = session_id
        response = await call_next(request)
        if "chat_session" not in request.cookies:
            response.set_cookie(
                "chat_session", session_id, httponly=True, samesite="lax", secure=False
            )
        return response

    @app.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": "2"}

    @app.post("/api/v1/safety/sanitize")
    def sanitize(payload: SafetyText) -> dict[str, str]:
        return {"content": sanitize_text(payload.content)}

    @app.get("/api/v1/runtime/health")
    async def runtime_health() -> dict[str, object]:
        available, loaded = await asyncio.gather(
            asyncio.to_thread(ollama_alive), asyncio.to_thread(running_models)
        )
        return {"ollama_available": available, "running_models": loaded}

    @app.get("/api/v1/profile", response_model=Profile)
    def get_profile() -> Profile:
        return Profile(content=store.get_profile())

    @app.put("/api/v1/profile", response_model=Profile)
    def set_profile(payload: Profile) -> Profile:
        return Profile(content=store.set_profile(payload.content))

    @app.post("/api/v1/conversations", response_model=Conversation, status_code=201)
    def create_conversation(payload: ConversationCreate) -> Conversation:
        return store.create_conversation(payload.title)

    @app.get("/api/v1/conversations", response_model=list[Conversation])
    def list_conversations(query: str = "") -> list[Conversation]:
        return store.list_conversations(query)

    @app.get("/api/v1/conversations/{conversation_id}", response_model=Conversation)
    def get_conversation(conversation_id: str) -> Conversation:
        try:
            return store.get_conversation(conversation_id)
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

    @app.patch("/api/v1/conversations/{conversation_id}", response_model=Conversation)
    def update_conversation(
        conversation_id: str, payload: ConversationUpdate
    ) -> Conversation:
        try:
            return store.update_conversation(
                conversation_id, title=payload.title, pinned=payload.pinned
            )
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

    @app.delete("/api/v1/conversations/{conversation_id}", status_code=204)
    def delete_conversation(conversation_id: str) -> Response:
        try:
            store.delete_conversation(conversation_id)
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc
        return Response(status_code=204)

    @app.post(
        "/api/v1/conversations/{conversation_id}/messages",
        response_model=Message,
        status_code=201,
    )
    def add_message(conversation_id: str, payload: MessageCreate) -> Message:
        try:
            return store.add_message(conversation_id, payload.role, payload.content)
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

    @app.post(
        "/api/v1/conversations/{conversation_id}/branch",
        response_model=Conversation,
        status_code=201,
    )
    def branch_conversation(
        conversation_id: str, payload: ConversationBranch
    ) -> Conversation:
        try:
            return store.branch_conversation(
                conversation_id, payload.message_id, payload.title
            )
        except KeyError as exc:
            raise HTTPException(404, "Conversation or message not found") from exc

    @app.post(
        "/api/v1/conversations/{conversation_id}/turns/preflight",
        response_model=ContextPlan,
    )
    async def preflight_turn(conversation_id: str, payload: TurnPreflight) -> ContextPlan:
        try:
            return await context_plan(conversation_id, payload)
        except KeyError as exc:
            raise HTTPException(404, "Conversation or context backpack not found") from exc

    @app.post(
        "/api/v1/conversations/{conversation_id}/turns",
        response_model=RunSnapshot,
        status_code=202,
    )
    async def create_turn(
        conversation_id: str, payload: TurnCreate, request: Request
    ) -> RunSnapshot:
        base = TurnPreflight(**payload.model_dump())
        try:
            cached_web = web_by_plan.get(payload.plan_hash)
            if cached_web is None:
                plan = await context_plan(conversation_id, base)
                cached_web = web_by_plan.get(plan.plan_hash, [])
            else:
                plan = build_context_plan(store, conversation_id, base, cached_web)
            if plan.plan_hash != payload.plan_hash:
                raise HTTPException(409, detail={"message": "Context changed", "plan": plan.model_dump()})
            required = {finding.id for finding in plan.findings}
            if not required.issubset(payload.confirmed_finding_ids):
                raise HTTPException(409, detail={"message": "Confirmation required", "plan": plan.model_dump()})
            messages = assemble_messages(
                store,
                conversation_id,
                base,
                plan,
                set(payload.excluded_source_ids),
                cached_web,
            )
            store.add_message(conversation_id, "user", payload.content)
        except KeyError as exc:
            raise HTTPException(404, "Conversation or context backpack not found") from exc
        run = RunCreate(
            provider=payload.provider,
            model=payload.model,
            messages=messages,
            temperature=payload.temperature,
            conversation_id=conversation_id,
        )
        return runs.create(run, request.state.session_id, plan.model_dump())

    @app.get("/api/v1/providers")
    def providers(request: Request) -> dict[str, list[dict[str, str | None]]]:
        return {
            "providers": [
                {
                    "id": provider_id,
                    "label": adapter.label,
                    "key_source": vault.source(request.state.session_id, provider_id),
                }
                for provider_id, adapter in registry.adapters.items()
            ]
        }

    @app.get("/api/v1/providers/models")
    async def provider_models(request: Request):
        return await registry.discover_models(
            lambda provider: vault.get(request.state.session_id, provider)
        )

    @app.post("/api/v1/providers/openrouter/auth/start")
    def start_openrouter_auth(request: Request) -> dict[str, str]:
        now = time.monotonic()
        for sid, (_, started_at) in list(oauth_verifiers.items()):
            if now - started_at > OAUTH_VERIFIER_TTL:
                oauth_verifiers.pop(sid, None)
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode()).digest()
        ).rstrip(b"=").decode()
        oauth_verifiers[request.state.session_id] = (verifier, now)
        callback_url = str(request.base_url).rstrip("/") + "/api/v1/providers/openrouter/auth/callback"
        query = urlencode(
            {
                "callback_url": callback_url,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            }
        )
        return {"authorization_url": f"https://openrouter.ai/auth?{query}", "callback_url": callback_url}

    @app.post("/api/v1/providers/openrouter/auth/complete", status_code=204)
    async def complete_openrouter_auth(payload: OAuthCodeInput, request: Request) -> Response:
        await exchange_openrouter_code(payload.code, request.state.session_id)
        return Response(status_code=204)

    @app.get("/api/v1/providers/openrouter/auth/callback")
    async def openrouter_auth_callback(code: str, request: Request) -> RedirectResponse:
        await exchange_openrouter_code(code, request.state.session_id)
        return RedirectResponse("/?provider=openrouter&connected=1", status_code=303)

    async def exchange_openrouter_code(code: str, session_id: str) -> None:
        entry = oauth_verifiers.pop(session_id, None)
        if entry is None:
            raise HTTPException(409, "No OpenRouter authorization is pending")
        verifier, _started_at = entry
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/auth/keys",
                json={
                    "code": code,
                    "code_verifier": verifier,
                    "code_challenge_method": "S256",
                },
            )
        if response.is_error:
            raise HTTPException(502, "OpenRouter authorization exchange failed")
        key = response.json().get("key")
        if not key:
            raise HTTPException(502, "OpenRouter returned no API key")
        vault.set(session_id, "openrouter", key)

    @app.put("/api/v1/providers/{provider}/credential", status_code=204)
    def set_credential(provider: str, payload: CredentialInput, request: Request) -> Response:
        if provider not in PROVIDER_ENV:
            raise HTTPException(404, "Provider not found")
        vault.set(request.state.session_id, provider, payload.api_key)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.delete("/api/v1/providers/{provider}/credential", status_code=204)
    def remove_credential(provider: str, request: Request) -> Response:
        if provider not in PROVIDER_ENV:
            raise HTTPException(404, "Provider not found")
        vault.remove(request.state.session_id, provider)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get("/api/v1/providers/{provider}/policy", response_model=ProviderPolicy)
    def get_provider_policy(provider: str) -> ProviderPolicy:
        if provider not in PROVIDER_ENV:
            raise HTTPException(404, "Provider not found")
        return store.get_policy(provider)

    @app.put("/api/v1/providers/{provider}/policy", response_model=ProviderPolicy)
    def set_provider_policy(provider: str, payload: ProviderPolicy) -> ProviderPolicy:
        if provider not in PROVIDER_ENV:
            raise HTTPException(404, "Provider not found")
        return store.set_policy(provider, payload)

    @app.post("/api/v1/providers/{provider}/simulate")
    def simulate_provider(
        provider: str, payload: ProviderSimulationInput
    ) -> dict[str, object]:
        if provider not in PROVIDER_ENV:
            raise HTTPException(404, "Provider not found")
        fallback = payload.fallback_provider
        if fallback is not None and fallback not in PROVIDER_ENV:
            raise HTTPException(404, "Fallback provider not found")
        labels = {
            "auth": "Authentication rejected",
            "timeout": "Request timed out",
            "rate_limit": "Rate limit reached",
            "disconnect": "Connection interrupted",
            "malformed": "Malformed provider response",
        }
        events: list[dict[str, str]] = [
            {
                "type": "attempt.failed",
                "provider": provider,
                "message": labels[payload.scenario],
            }
        ]
        if fallback:
            events.extend(
                [
                    {"type": "fallback.selected", "provider": fallback, "message": ""},
                    {"type": "attempt.succeeded", "provider": fallback, "message": ""},
                ]
            )
        return {
            "scenario": payload.scenario,
            "recovered": bool(fallback),
            "events": events,
        }

    @app.get("/api/v1/backpacks", response_model=list[Backpack])
    def list_backpacks() -> list[Backpack]:
        return store.list_backpacks()

    @app.post("/api/v1/backpacks", response_model=Backpack, status_code=201)
    def create_backpack(payload: BackpackCreate) -> Backpack:
        return store.create_backpack(payload)

    @app.put("/api/v1/backpacks/{backpack_id}", response_model=Backpack)
    def update_backpack(backpack_id: str, payload: BackpackCreate) -> Backpack:
        try:
            return store.update_backpack(backpack_id, payload)
        except KeyError as exc:
            raise HTTPException(404, "Backpack not found") from exc

    @app.delete("/api/v1/backpacks/{backpack_id}", status_code=204)
    def delete_backpack(backpack_id: str) -> Response:
        try:
            store.delete_backpack(backpack_id)
        except KeyError as exc:
            raise HTTPException(404, "Backpack not found") from exc
        return Response(status_code=204)

    @app.post("/api/v1/focus-sessions", response_model=FocusSession, status_code=201)
    def create_focus(payload: FocusCreate) -> FocusSession:
        try:
            return store.create_focus(payload)
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

    @app.get("/api/v1/focus-sessions", response_model=list[FocusSession])
    def list_focus(conversation_id: str | None = None) -> list[FocusSession]:
        return store.list_focus(conversation_id)

    @app.patch("/api/v1/focus-sessions/{focus_id}", response_model=FocusSession)
    def update_focus(focus_id: str, payload: FocusUpdate) -> FocusSession:
        try:
            return store.update_focus(focus_id, payload.status)
        except KeyError as exc:
            raise HTTPException(404, "Focus session not found") from exc

    @app.get("/api/v1/memories", response_model=list[Memory])
    def list_memories() -> list[Memory]:
        return store.list_memories()

    @app.post("/api/v1/memories", response_model=Memory, status_code=201)
    def create_memory(payload: MemoryCreate) -> Memory:
        findings = [item for item in scan_text(payload.content) if item.category == "prompt_injection"]
        return store.create_memory(
            payload.content,
            payload.category,
            payload.source_conversation_id,
            status="quarantined" if findings else "active",
            quarantine_reason=findings[0].message if findings else None,
        )

    @app.patch("/api/v1/memories/{memory_id}", response_model=Memory)
    def update_memory(memory_id: str, payload: MemoryUpdate) -> Memory:
        try:
            return store.update_memory(memory_id, **payload.model_dump(exclude_unset=True))
        except KeyError as exc:
            raise HTTPException(404, "Memory not found") from exc

    @app.delete("/api/v1/memories/{memory_id}", status_code=204)
    def delete_memory(memory_id: str) -> Response:
        try:
            store.delete_memory(memory_id)
        except KeyError as exc:
            raise HTTPException(404, "Memory not found") from exc
        return Response(status_code=204)

    @app.get("/api/v1/presets", response_model=list[Preset])
    def list_presets() -> list[Preset]:
        return store.list_presets()

    @app.post("/api/v1/presets", response_model=Preset, status_code=201)
    def create_preset(payload: PresetCreate) -> Preset:
        try:
            return store.create_preset(payload)
        except Exception as exc:
            if "UNIQUE constraint" in str(exc):
                raise HTTPException(409, "Preset name already exists") from exc
            raise

    @app.delete("/api/v1/presets/{preset_id}", status_code=204)
    def delete_preset(preset_id: str) -> Response:
        try:
            store.delete_preset(preset_id)
        except KeyError as exc:
            raise HTTPException(404, "Preset not found") from exc
        return Response(status_code=204)

    @app.put("/api/v1/messages/{message_id}/feedback", status_code=204)
    def set_feedback(message_id: str, payload: FeedbackInput) -> Response:
        try:
            store.set_feedback(message_id, payload.rating)
        except KeyError as exc:
            raise HTTPException(404, "Message not found") from exc
        return Response(status_code=204)

    @app.get("/api/v1/conversations/{conversation_id}/feedback")
    def get_feedback(conversation_id: str) -> dict[str, int]:
        try:
            return store.get_feedback(conversation_id)
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

    @app.get(
        "/api/v1/conversations/{conversation_id}/export.md",
        response_class=PlainTextResponse,
    )
    def export_conversation(conversation_id: str) -> str:
        try:
            return store.export_conversation_markdown(conversation_id)
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

    @app.get("/api/v1/data/export")
    def export_data() -> dict[str, str]:
        return {"jsonl": store.export_jsonl()}

    @app.post("/api/v1/data/import")
    def import_data(payload: DataImport) -> dict[str, int]:
        return {"imported": store.import_jsonl(payload.jsonl)}

    @app.post("/api/v1/data/import-v2")
    def import_v2(_: V2ImportRequest) -> dict[str, int]:
        try:
            return {"imported": store.import_v2_database(v2_database)}
        except FileNotFoundError as exc:
            raise HTTPException(404, "No v2 database is available to import") from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/api/v1/data/wipe", status_code=204)
    async def wipe_data(_: WipeRequest, request: Request) -> Response:
        await asyncio.to_thread(store.wipe)
        runs.clear()
        vault.clear(request.state.session_id)
        oauth_verifiers.pop(request.state.session_id, None)
        web_by_plan.clear()
        return Response(status_code=204)

    @app.post("/api/v1/uploads", response_model=Upload, status_code=201)
    def create_upload(payload: UploadCreate) -> Upload:
        filename = Path(payload.filename).name
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if extension not in ACCEPTED_TYPES:
            raise HTTPException(415, "File type not supported")
        try:
            raw = base64.b64decode(payload.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(422, "Invalid base64 content") from exc
        if len(raw) > 10 * 1024 * 1024:
            raise HTTPException(413, "File exceeds the 10 MB limit")
        try:
            attachment = parse_upload(filename, raw)
            return store.create_upload(
                payload.conversation_id,
                filename,
                attachment.kind,
                attachment.mime,
                raw,
                attachment.text,
            )
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc
        except Exception as exc:
            raise HTTPException(422, "File could not be parsed") from exc

    @app.get("/api/v1/conversations/{conversation_id}/uploads", response_model=list[Upload])
    def list_uploads(conversation_id: str) -> list[Upload]:
        return store.list_uploads(conversation_id)

    @app.post("/api/v1/runs", response_model=RunSnapshot, status_code=202)
    async def create_run(payload: RunCreate, request: Request) -> RunSnapshot:
        return runs.create(payload, request.state.session_id)

    @app.get("/api/v1/runs/{run_id}", response_model=RunSnapshot)
    def get_run(run_id: str, request: Request) -> RunSnapshot:
        try:
            return runs.get(run_id, request.state.session_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc

    @app.get("/api/v1/runs/{run_id}/events")
    async def run_events(run_id: str, request: Request) -> StreamingResponse:
        try:
            runs.get(run_id, request.state.session_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc

        async def stream() -> AsyncIterator[str]:
            async for event in runs.events(run_id, request.state.session_id):
                yield f"event: {event.type}\ndata: {json.dumps(event.model_dump())}\n\n"

        return StreamingResponse(stream(), media_type="text/event-stream")

    @app.delete("/api/v1/runs/{run_id}", response_model=RunSnapshot)
    def cancel_run(run_id: str, request: Request) -> RunSnapshot:
        try:
            return runs.cancel(run_id, request.state.session_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc

    @app.get("/api/v1/runs/{run_id}/bundle", response_model=ReplayBundle)
    def run_bundle(
        run_id: str, request: Request, mode: str = "full"
    ) -> ReplayBundle:
        if mode not in {"full", "redacted"}:
            raise HTTPException(422, "Bundle mode must be full or redacted")
        try:
            bundle = store.run_bundle(run_id, request.state.session_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc
        run = bundle["snapshot"]
        request_data = bundle["request"]
        if mode == "redacted":
            run = run.model_copy(
                update={"output": sanitize_text(run.output), "error": None}
            )
        return ReplayBundle(
            run=run,
            messages=[
                {
                    **message,
                    "content": sanitize_text(message.get("content", "")),
                    "images": [],
                }
                if mode == "redacted"
                else message
                for message in request_data.get("messages", [])
            ],
            context=None if mode == "redacted" else bundle["context"],
            integrity={"algorithm": "sha256-chain", "hash": run.receipt_hash or ""},
        )

    @app.get("/api/v1/activity", response_model=list[RunSnapshot])
    def activity(request: Request) -> list[RunSnapshot]:
        return store.list_runs(request.state.session_id)

    @app.post("/api/v1/runs/{run_id}/replay", response_model=RunSnapshot, status_code=202)
    async def replay_run(
        run_id: str, payload: ReplayCreate, request: Request
    ) -> RunSnapshot:
        try:
            bundle = store.run_bundle(run_id, request.state.session_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc
        original = bundle["request"]
        replay = RunCreate(
            provider=payload.provider,
            model=payload.model,
            messages=original["messages"],
            temperature=payload.temperature
            if payload.temperature is not None
            else original.get("temperature", 0.7),
        )
        context = dict(bundle["context"] or {})
        context["replay_of"] = run_id
        return runs.create(replay, request.state.session_id, context)

    @app.get("/api/v1/runs/{left_id}/diff/{right_id}")
    def diff_runs(left_id: str, right_id: str, request: Request) -> dict:
        try:
            left = store.run_bundle(left_id, request.state.session_id)["snapshot"]
            right = store.run_bundle(right_id, request.state.session_id)["snapshot"]
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc
        diff = "\n".join(
            difflib.unified_diff(
                left.output.splitlines(),
                right.output.splitlines(),
                fromfile=left.id,
                tofile=right.id,
                lineterm="",
            )
        )
        return {"changed": left.output != right.output, "diff": diff}

    frontend_dist = Path(__file__).parents[2] / "frontend" / "dist"
    if frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app
