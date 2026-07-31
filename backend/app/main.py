from __future__ import annotations

import json
import os
import time
import base64
import hashlib
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlencode

import httpx

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.app.contracts import (
    Conversation,
    ConversationCreate,
    CredentialInput,
    Message,
    MessageCreate,
    OAuthCodeInput,
    RunCreate,
    RunSnapshot,
)
from backend.app.runs import RunManager
from backend.app.providers import ProviderRegistry, build_provider_registry
from backend.app.sessions import PROVIDER_ENV, SessionVault
from backend.app.store import Store


def create_app(
    database_url: str | None = None,
    provider_registry: ProviderRegistry | None = None,
) -> FastAPI:
    data_dir = Path(os.getenv("CHAT_DATA_DIR", "data/v2"))
    store = Store(database_url or str(data_dir / "studio.db"))
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

    @app.post("/api/v1/conversations", response_model=Conversation, status_code=201)
    def create_conversation(payload: ConversationCreate) -> Conversation:
        return store.create_conversation(payload.title)

    @app.get("/api/v1/conversations", response_model=list[Conversation])
    def list_conversations() -> list[Conversation]:
        return store.list_conversations()

    @app.get("/api/v1/conversations/{conversation_id}", response_model=Conversation)
    def get_conversation(conversation_id: str) -> Conversation:
        try:
            return store.get_conversation(conversation_id)
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

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

    @app.post("/api/v1/runs", response_model=RunSnapshot, status_code=202)
    async def create_run(payload: RunCreate, request: Request) -> RunSnapshot:
        return runs.create(payload, request.state.session_id)

    @app.get("/api/v1/runs/{run_id}", response_model=RunSnapshot)
    def get_run(run_id: str) -> RunSnapshot:
        try:
            return runs.get(run_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc

    @app.get("/api/v1/runs/{run_id}/events")
    async def run_events(run_id: str) -> StreamingResponse:
        try:
            runs.get(run_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc

        async def stream() -> AsyncIterator[str]:
            async for event in runs.events(run_id):
                yield f"event: {event.type}\ndata: {json.dumps(event.model_dump())}\n\n"

        return StreamingResponse(stream(), media_type="text/event-stream")

    @app.delete("/api/v1/runs/{run_id}", response_model=RunSnapshot)
    def cancel_run(run_id: str) -> RunSnapshot:
        try:
            return runs.cancel(run_id)
        except KeyError as exc:
            raise HTTPException(404, "Run not found") from exc

    frontend_dist = Path(__file__).parents[2] / "frontend" / "dist"
    if frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app
