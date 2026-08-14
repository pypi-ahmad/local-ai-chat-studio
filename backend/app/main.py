from __future__ import annotations

import base64
import asyncio
import binascii
import difflib
import hashlib
import json
import logging
import os
import secrets
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlencode

import httpx
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError, ValidationError

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

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
    KnowledgeBase,
    KnowledgeBaseCreate,
    Memory,
    MemoryCreate,
    MemoryExtractionRequest,
    MemoryExtractionResult,
    MemoryUpdate,
    McpServer,
    McpServerCreate,
    McpTool,
    Message,
    MessageCreate,
    OAuthCodeInput,
    OpenCodeOAuthComplete,
    OpenCodeOAuthStart,
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
    ToolDecision,
    ToolRequest,
    ToolRequestCreate,
    Upload,
    UploadCreate,
    V2ImportRequest,
    WipeRequest,
)
from backend.app.memory import extract_memories
from backend.app.mcp_tools import DefaultMcpGateway, McpGateway, safe_result_preview
from backend.app.runs import RunManager
from backend.app.providers import (
    OpenCodeBridgeAdapter,
    ProviderRegistry,
    build_provider_registry,
)
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


logger = logging.getLogger(__name__)


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: dict) -> Response:
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            response = Response(status_code=404)

        accepts_html = "text/html" in dict(scope.get("headers", [])).get(
            b"accept", b""
        ).decode("latin-1")
        is_browser_route = not Path(path).suffix and not path.startswith("api/")
        if response.status_code == 404 and accepts_html and is_browser_route:
            return await super().get_response("index.html", scope)
        return response


def create_app(
    database_url: str | None = None,
    provider_registry: ProviderRegistry | None = None,
    v2_database_url: str | None = None,
    shutdown_callback: Callable[[], None] | None = None,
    mcp_gateway: McpGateway | None = None,
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
        raise RuntimeError(
            f"Providers missing from PROVIDER_ENV: {sorted(missing_env)}"
        )
    runs = RunManager(registry, vault, store)
    tool_gateway = mcp_gateway or DefaultMcpGateway(data_dir / "mcp-sandboxes")
    web_by_plan: dict[str, list[dict[str, str]]] = {}

    async def context_plan(conversation_id: str, payload: TurnPreflight) -> ContextPlan:
        if payload.attachment_ids:
            uploads = {item.id: item for item in store.list_uploads(conversation_id)}
            if missing := set(payload.attachment_ids) - uploads.keys():
                raise KeyError(next(iter(missing)))
            if any(uploads[item].kind == "image" for item in payload.attachment_ids):
                if registry.supports_images(payload.provider, payload.model) is False:
                    raise HTTPException(
                        422, "Selected model does not support image input"
                    )
        provisional = build_context_plan(store, conversation_id, payload)
        web_enabled = any(
            section.kind == "web" and section.included
            for section in provisional.sections
        )
        results = (
            await asyncio.to_thread(search_web, payload.content) if web_enabled else []
        )
        plan = build_context_plan(store, conversation_id, payload, results)
        if len(web_by_plan) >= 128:
            web_by_plan.pop(next(iter(web_by_plan)))
        web_by_plan[plan.plan_hash] = results
        return plan

    def sync_memory_index(memory: Memory) -> None:
        embed_model = os.getenv("CHAT_EMBED_MODEL")
        if not embed_model:
            return
        try:
            from src.rag import delete_memory_vector, index_memory

            delete_memory_vector(memory.id)
            if memory.status == "active":
                index_memory(embed_model, memory.id, memory.content)
        except Exception as exc:
            logger.warning("Memory index update failed: %s", type(exc).__name__)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            yield
        finally:
            await runs.shutdown()
            store.connection.close()

    app = FastAPI(title="Local AI Chat Studio API", version="2.0.0", lifespan=lifespan)
    app.state.store, app.state.vault, app.state.runs = store, vault, runs
    app.state.providers = registry
    app.state.mcp_gateway = tool_gateway

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

    @app.post("/api/v1/mcp/servers", response_model=McpServer, status_code=201)
    def create_mcp_server(payload: McpServerCreate) -> McpServer:
        return store.create_mcp_server(payload)

    @app.get("/api/v1/mcp/servers", response_model=list[McpServer])
    def list_mcp_servers() -> list[McpServer]:
        return store.list_mcp_servers()

    @app.delete("/api/v1/mcp/servers/{server_id}", status_code=204)
    def delete_mcp_server(server_id: str) -> Response:
        try:
            store.delete_mcp_server(server_id)
        except KeyError as exc:
            raise HTTPException(404, "MCP server not found") from exc
        except RuntimeError as exc:
            raise HTTPException(409, str(exc)) from exc
        return Response(status_code=204)

    @app.post(
        "/api/v1/mcp/servers/{server_id}/discover",
        response_model=list[McpTool],
    )
    async def discover_mcp_tools(server_id: str) -> list[McpTool]:
        try:
            server = store.get_mcp_server(server_id)
            tools = await tool_gateway.discover(server)
            return store.replace_mcp_tools(server_id, tools)
        except KeyError as exc:
            raise HTTPException(404, "MCP server not found") from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        except TimeoutError as exc:
            raise HTTPException(504, "MCP discovery timed out") from exc
        except Exception as exc:
            logger.warning("MCP discovery failed: %s", type(exc).__name__)
            raise HTTPException(502, "MCP server discovery failed") from exc

    @app.get(
        "/api/v1/mcp/servers/{server_id}/tools",
        response_model=list[McpTool],
    )
    def list_mcp_tools(server_id: str) -> list[McpTool]:
        try:
            return store.list_mcp_tools(server_id)
        except KeyError as exc:
            raise HTTPException(404, "MCP server not found") from exc

    @app.post("/api/v1/tool-requests", response_model=ToolRequest, status_code=201)
    def create_tool_request(payload: ToolRequestCreate, request: Request) -> ToolRequest:
        try:
            tool = store.get_mcp_tool(payload.server_id, payload.tool_name)
            Draft202012Validator.check_schema(tool.input_schema)
            Draft202012Validator(tool.input_schema).validate(payload.arguments)
            if payload.conversation_id:
                store.get_conversation(payload.conversation_id)
            return store.create_tool_request(
                store.session_hash(request.state.session_id), payload
            )
        except KeyError as exc:
            raise HTTPException(404, "MCP server, tool, or conversation not found") from exc
        except (SchemaError, ValidationError) as exc:
            raise HTTPException(422, f"Tool arguments do not match its schema: {exc.message}") from exc

    @app.get("/api/v1/tool-requests", response_model=list[ToolRequest])
    def list_tool_requests(request: Request) -> list[ToolRequest]:
        return store.list_tool_requests(store.session_hash(request.state.session_id))

    @app.post(
        "/api/v1/tool-requests/{request_id}/approve",
        response_model=ToolRequest,
    )
    async def approve_tool_request(
        request_id: str, payload: ToolDecision, request: Request
    ) -> ToolRequest:
        session_hash = store.session_hash(request.state.session_id)
        try:
            pending, arguments = store.claim_tool_request(
                request_id, session_hash, payload.reason
            )
        except KeyError as exc:
            raise HTTPException(404, "Tool request not found") from exc
        except RuntimeError as exc:
            raise HTTPException(409, str(exc)) from exc

        try:
            server = store.get_mcp_server(pending.server_id)
            result = await tool_gateway.call(server, pending.tool_name, arguments)
            preview = safe_result_preview(result)
            failed = bool(result.get("is_error"))
            completed = store.finish_tool_request(
                request_id,
                session_hash,
                status="failed" if failed else "completed",
                result_preview=preview,
                error="MCP tool reported an error" if failed else None,
            )
            if completed.conversation_id and not failed:
                store.add_message(
                    completed.conversation_id,
                    "tool",
                    preview or "Tool completed without text output.",
                    metadata={
                        "server": completed.server_name,
                        "tool": completed.tool_name,
                        "tool_request_id": completed.id,
                    },
                )
            return completed
        except KeyError as exc:
            store.finish_tool_request(
                request_id, session_hash, status="failed", error="MCP server was removed"
            )
            raise HTTPException(409, "MCP server was removed") from exc
        except Exception as exc:
            logger.warning("MCP tool execution failed: %s", type(exc).__name__)
            return store.finish_tool_request(
                request_id,
                session_hash,
                status="failed",
                error="MCP tool execution failed or timed out",
            )

    @app.post(
        "/api/v1/tool-requests/{request_id}/deny",
        response_model=ToolRequest,
    )
    def deny_tool_request(
        request_id: str, payload: ToolDecision, request: Request
    ) -> ToolRequest:
        try:
            return store.deny_tool_request(
                request_id,
                store.session_hash(request.state.session_id),
                payload.reason,
            )
        except KeyError as exc:
            raise HTTPException(404, "Tool request not found") from exc
        except RuntimeError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.post("/api/v1/safety/sanitize")
    def sanitize(payload: SafetyText) -> dict[str, str]:
        return {"content": sanitize_text(payload.content)}

    @app.get("/api/v1/runtime/health")
    async def runtime_health() -> dict[str, object]:
        available, loaded = await asyncio.gather(
            asyncio.to_thread(ollama_alive), asyncio.to_thread(running_models)
        )
        return {"ollama_available": available, "running_models": loaded}

    @app.post("/api/v1/runtime/shutdown", status_code=202)
    async def shutdown(
        request: Request, background_tasks: BackgroundTasks
    ) -> dict[str, str]:
        if request.headers.get("X-Local-Studio") != "shutdown":
            raise HTTPException(
                403, "Shutdown request was not issued by the local Studio UI"
            )
        if shutdown_callback is None:
            raise HTTPException(503, "Server shutdown is unavailable in unmanaged mode")
        await runs.shutdown()
        background_tasks.add_task(shutdown_callback)
        return {"status": "stopping"}

    @app.get("/api/v1/profile", response_model=Profile)
    def get_profile() -> Profile:
        return Profile(content=store.get_profile())

    @app.put("/api/v1/profile", response_model=Profile)
    def set_profile(payload: Profile) -> Profile:
        return Profile(content=store.set_profile(payload.content))

    @app.post("/api/v1/conversations", response_model=Conversation, status_code=201)
    def create_conversation(payload: ConversationCreate) -> Conversation:
        return store.create_conversation(payload.title, settings=payload.settings)

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
                conversation_id,
                title=payload.title,
                pinned=payload.pinned,
                settings=payload.settings,
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
    async def preflight_turn(
        conversation_id: str, payload: TurnPreflight
    ) -> ContextPlan:
        try:
            return await context_plan(conversation_id, payload)
        except KeyError as exc:
            raise HTTPException(
                404, "Conversation or context backpack not found"
            ) from exc

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
                raise HTTPException(
                    409,
                    detail={"message": "Context changed", "plan": plan.model_dump()},
                )
            if plan.estimated_tokens > plan.budget_tokens:
                raise HTTPException(
                    422,
                    detail={
                        "message": "Context exceeds the safe budget",
                        "plan": plan.model_dump(),
                    },
                )
            required = {finding.id for finding in plan.findings}
            if not required.issubset(payload.confirmed_finding_ids):
                raise HTTPException(
                    409,
                    detail={
                        "message": "Confirmation required",
                        "plan": plan.model_dump(),
                    },
                )
            messages = assemble_messages(
                store,
                conversation_id,
                base,
                plan,
                set(payload.excluded_source_ids),
                cached_web,
            )
            store.add_message(
                conversation_id,
                "user",
                payload.content,
                metadata={"attachment_ids": payload.attachment_ids},
            )
        except KeyError as exc:
            raise HTTPException(
                404, "Conversation or context backpack not found"
            ) from exc
        run = RunCreate(
            provider=payload.provider,
            model=payload.model,
            messages=messages,
            temperature=payload.temperature,
            reasoning_effort=payload.reasoning_effort,
            conversation_id=conversation_id,
        )
        return runs.create(run, request.state.session_id, plan.model_dump())

    @app.get("/api/v1/providers")
    def providers(request: Request) -> dict[str, list[dict[str, object]]]:
        return {
            "providers": [
                {
                    "id": provider_id,
                    "label": adapter.label,
                    "key_source": vault.source(request.state.session_id, provider_id),
                    "auth_modes": list(adapter.auth_modes),
                    "connected": bool(
                        vault.source(request.state.session_id, provider_id)
                        or "none" in adapter.auth_modes
                    ),
                    "health": "ready"
                    if (
                        vault.source(request.state.session_id, provider_id)
                        or "none" in adapter.auth_modes
                    )
                    else "not_configured",
                }
                for provider_id, adapter in registry.adapters.items()
            ]
        }

    @app.get("/api/v1/providers/models")
    async def provider_models(request: Request):
        return await registry.discover_models(
            lambda provider: vault.get(request.state.session_id, provider)
        )

    def opencode_bridge() -> OpenCodeBridgeAdapter:
        adapter = registry.adapters.get("opencode-bridge")
        if not isinstance(adapter, OpenCodeBridgeAdapter):
            raise HTTPException(404, "OpenCode bridge is not configured")
        return adapter

    @app.get("/api/v1/providers/opencode-bridge/status")
    async def opencode_status() -> dict[str, object]:
        try:
            return {"connected": True, **await opencode_bridge().health()}
        except Exception as exc:
            logger.info("OpenCode bridge unavailable: %s", type(exc).__name__)
            return {"connected": False}

    @app.get("/api/v1/providers/opencode-bridge/auth/methods")
    async def opencode_auth_methods() -> dict[str, list[dict[str, object]]]:
        try:
            methods = await opencode_bridge().oauth_methods()
        except Exception as exc:
            raise HTTPException(502, "OpenCode bridge is unavailable") from exc
        return {
            provider: [
                {**method, "method": index}
                for index, method in enumerate(provider_methods)
                if method.get("type") == "oauth"
            ]
            for provider, provider_methods in methods.items()
            if any(method.get("type") == "oauth" for method in provider_methods)
        }

    @app.post("/api/v1/providers/opencode-bridge/auth/{upstream}/start")
    async def start_opencode_auth(
        upstream: str, payload: OpenCodeOAuthStart
    ) -> dict[str, str]:
        methods = await opencode_auth_methods()
        if not any(
            item["method"] == payload.method for item in methods.get(upstream, [])
        ):
            raise HTTPException(404, "OpenCode OAuth method not found")
        try:
            return await opencode_bridge().oauth_authorize(upstream, payload.method)
        except Exception as exc:
            raise HTTPException(502, "OpenCode OAuth authorization failed") from exc

    @app.post("/api/v1/providers/opencode-bridge/auth/{upstream}/complete")
    async def complete_opencode_auth(
        upstream: str, payload: OpenCodeOAuthComplete
    ) -> dict[str, bool]:
        methods = await opencode_auth_methods()
        if not any(
            item["method"] == payload.method for item in methods.get(upstream, [])
        ):
            raise HTTPException(404, "OpenCode OAuth method not found")
        try:
            connected = await opencode_bridge().oauth_complete(
                upstream, payload.method, payload.code
            )
        except Exception as exc:
            raise HTTPException(502, "OpenCode OAuth callback failed") from exc
        return {"connected": connected}

    @app.post("/api/v1/providers/openrouter/auth/start")
    def start_openrouter_auth(request: Request) -> dict[str, str]:
        now = time.monotonic()
        for sid, (_, started_at) in list(oauth_verifiers.items()):
            if now - started_at > OAUTH_VERIFIER_TTL:
                oauth_verifiers.pop(sid, None)
        verifier = secrets.token_urlsafe(64)
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .rstrip(b"=")
            .decode()
        )
        oauth_verifiers[request.state.session_id] = (verifier, now)
        callback_url = (
            str(request.base_url).rstrip("/")
            + "/api/v1/providers/openrouter/auth/callback"
        )
        query = urlencode(
            {
                "callback_url": callback_url,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            }
        )
        return {
            "authorization_url": f"https://openrouter.ai/auth?{query}",
            "callback_url": callback_url,
        }

    @app.post("/api/v1/providers/openrouter/auth/complete", status_code=204)
    async def complete_openrouter_auth(
        payload: OAuthCodeInput, request: Request
    ) -> Response:
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
    def set_credential(
        provider: str, payload: CredentialInput, request: Request
    ) -> Response:
        adapter = registry.adapters.get(provider)
        if adapter is None:
            raise HTTPException(404, "Provider not found")
        if "api_key" not in adapter.auth_modes:
            raise HTTPException(400, "Provider does not accept API keys")
        vault.set(request.state.session_id, provider, payload.api_key)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.delete("/api/v1/providers/{provider}/credential", status_code=204)
    def remove_credential(provider: str, request: Request) -> Response:
        if provider not in registry.adapters:
            raise HTTPException(404, "Provider not found")
        vault.remove(request.state.session_id, provider)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get("/api/v1/providers/{provider}/policy", response_model=ProviderPolicy)
    def get_provider_policy(provider: str) -> ProviderPolicy:
        if provider not in registry.adapters:
            raise HTTPException(404, "Provider not found")
        return store.get_policy(provider)

    @app.put("/api/v1/providers/{provider}/policy", response_model=ProviderPolicy)
    def set_provider_policy(provider: str, payload: ProviderPolicy) -> ProviderPolicy:
        if provider not in registry.adapters:
            raise HTTPException(404, "Provider not found")
        return store.set_policy(provider, payload)

    @app.post("/api/v1/providers/{provider}/simulate")
    def simulate_provider(
        provider: str, payload: ProviderSimulationInput
    ) -> dict[str, object]:
        if provider not in registry.adapters:
            raise HTTPException(404, "Provider not found")
        fallback = payload.fallback_provider
        if fallback is not None and fallback not in registry.adapters:
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
        findings = [
            item
            for item in scan_text(payload.content)
            if item.category == "prompt_injection"
        ]
        memory = store.create_memory(
            payload.content,
            payload.category,
            payload.source_conversation_id,
            status="quarantined" if findings else "active",
            quarantine_reason=findings[0].message if findings else None,
        )
        sync_memory_index(memory)
        return memory

    @app.post(
        "/api/v1/conversations/{conversation_id}/memories/extract",
        response_model=MemoryExtractionResult,
    )
    async def extract_conversation_memories(
        conversation_id: str,
        payload: MemoryExtractionRequest,
        request: Request,
    ) -> MemoryExtractionResult:
        adapter = registry.adapters.get(payload.provider)
        if adapter is None:
            raise HTTPException(404, "Provider not found")
        if payload.provider != "ollama-local" and not payload.cloud_confirmed:
            raise HTTPException(
                409, "Confirm sending the full conversation to this provider"
            )
        try:
            conversation = store.get_conversation(conversation_id)
            outcome = await extract_memories(
                conversation,
                adapter,
                vault.get(request.state.session_id, payload.provider),
                payload.model,
                [item.content for item in store.list_memories()],
            )
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc
        except ValueError as exc:
            raise HTTPException(502, str(exc)) from exc
        safe_candidates = []
        discarded = outcome.discarded
        for candidate in outcome.candidates:
            findings = scan_text(candidate["content"])
            if any(item.category in {"secret", "pii"} for item in findings):
                discarded += 1
                continue
            if injection := next(
                (item for item in findings if item.category == "prompt_injection"), None
            ):
                candidate["status"] = "quarantined"
                candidate["quarantine_reason"] = injection.message
            safe_candidates.append(candidate)
        memories = store.create_memories_batch(
            conversation_id,
            safe_candidates,
            payload.provider,
            payload.model,
        )
        for memory in memories:
            sync_memory_index(memory)
        return MemoryExtractionResult(
            saved=sum(item.status == "active" for item in memories),
            quarantined=sum(item.status == "quarantined" for item in memories),
            discarded=discarded,
        )

    @app.patch("/api/v1/memories/{memory_id}", response_model=Memory)
    def update_memory(memory_id: str, payload: MemoryUpdate) -> Memory:
        try:
            memory = store.update_memory(
                memory_id, **payload.model_dump(exclude_unset=True)
            )
        except KeyError as exc:
            raise HTTPException(404, "Memory not found") from exc
        sync_memory_index(memory)
        return memory

    @app.delete("/api/v1/memories/{memory_id}", status_code=204)
    def delete_memory(memory_id: str) -> Response:
        try:
            store.delete_memory(memory_id)
        except KeyError as exc:
            raise HTTPException(404, "Memory not found") from exc
        if os.getenv("CHAT_EMBED_MODEL"):
            try:
                from src.rag import delete_memory_vector

                delete_memory_vector(memory_id)
            except Exception as exc:
                logger.warning("Memory index delete failed: %s", type(exc).__name__)
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
    )
    def export_conversation(conversation_id: str) -> Response:
        try:
            return Response(
                store.export_conversation_markdown(conversation_id),
                media_type="text/markdown",
            )
        except KeyError as exc:
            raise HTTPException(404, "Conversation not found") from exc

    @app.get("/api/v1/conversations/{conversation_id}/export/{export_format}")
    def export_conversation_format(
        conversation_id: str, export_format: str
    ) -> Response:
        exporters = {
            "markdown": (store.export_conversation_markdown, "text/markdown"),
            "html": (store.export_conversation_html, "text/html"),
            "txt": (store.export_conversation_text, "text/plain"),
            "json": (store.export_conversation_json, "application/json"),
        }
        if export_format not in exporters:
            raise HTTPException(422, "Export format must be markdown, html, txt, or json")
        exporter, media_type = exporters[export_format]
        try:
            return Response(exporter(conversation_id), media_type=media_type)
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

    @app.get(
        "/api/v1/conversations/{conversation_id}/uploads", response_model=list[Upload]
    )
    def list_uploads(conversation_id: str) -> list[Upload]:
        return store.list_uploads(conversation_id)

    @app.delete("/api/v1/uploads/{upload_id}", status_code=204)
    def delete_upload(upload_id: str) -> Response:
        try:
            store.delete_upload(upload_id)
        except KeyError as exc:
            raise HTTPException(404, "Upload not found") from exc
        return Response(status_code=204)

    @app.get("/api/v1/knowledge-bases", response_model=list[KnowledgeBase])
    def list_knowledge_bases() -> list[KnowledgeBase]:
        return store.list_knowledge_bases()

    @app.post(
        "/api/v1/knowledge-bases", response_model=KnowledgeBase, status_code=201
    )
    def create_knowledge_base(payload: KnowledgeBaseCreate) -> KnowledgeBase:
        try:
            return store.create_knowledge_base(payload)
        except KeyError as exc:
            raise HTTPException(404, "Knowledge source not found") from exc
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.put("/api/v1/knowledge-bases/{knowledge_base_id}", response_model=KnowledgeBase)
    def update_knowledge_base(
        knowledge_base_id: str, payload: KnowledgeBaseCreate
    ) -> KnowledgeBase:
        try:
            return store.update_knowledge_base(knowledge_base_id, payload)
        except KeyError as exc:
            raise HTTPException(404, "Knowledge base or source not found") from exc
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.delete("/api/v1/knowledge-bases/{knowledge_base_id}", status_code=204)
    def delete_knowledge_base(knowledge_base_id: str) -> Response:
        try:
            store.delete_knowledge_base(knowledge_base_id)
        except KeyError as exc:
            raise HTTPException(404, "Knowledge base not found") from exc
        return Response(status_code=204)

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
    def run_bundle(run_id: str, request: Request, mode: str = "full") -> ReplayBundle:
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

    @app.post(
        "/api/v1/runs/{run_id}/replay", response_model=RunSnapshot, status_code=202
    )
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
            reasoning_effort=original.get("reasoning_effort"),
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
        app.mount("/", SPAStaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app
