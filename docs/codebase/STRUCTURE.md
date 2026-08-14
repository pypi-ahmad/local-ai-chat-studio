# Codebase Structure

| Path | Responsibility |
|---|---|
| `backend/app/cli.py` | Uvicorn on `127.0.0.1:8506` and managed-shutdown callback |
| `backend/app/main.py` | FastAPI composition, routes, session cookies, OAuth, static client, shutdown |
| `backend/app/mcp_tools.py` | MCP stdio/Streamable HTTP gateway, public-host checks, isolated process environment, and redaction |
| `backend/app/contracts.py` | Pydantic API contracts, conversation-settings validation, and generated-schema source |
| `backend/app/runs.py` | Async streaming lifecycle, cancellation, events, receipts, task drain |
| `backend/app/store.py` | Legacy-compatible SQLite schema, migrations, conversation settings, and knowledge-base source ledgers |
| `backend/app/memory.py` | Whole-chat LLM memory selection, consolidation, and validation |
| `backend/app/workspace.py` | Context plans, safety, provenance, web and retrieval |
| `backend/app/providers.py` | Provider adapters and model discovery |
| `backend/app/pricing.py` | Source-linked standard token-rate catalog and normalization |
| `frontend/src/App.tsx` | Session-owned data orchestration, route composition, navigation shell, and generated API coordination |
| `frontend/src/app/` | Typed browser-route map and page-level error boundary |
| `frontend/src/routes/` | Page components for Chat, Compare, Library, Focus, Replay, Context, Evidence, Providers, and Settings |
| `frontend/src/features/composer/` | Chat input, attachments, model/effort/context controls, and send/stop actions |
| `frontend/src/features/messages/` | Rich response rendering, artifact actions, transcript navigation, and unread-output state |
| `frontend/src/features/context/` | Context budget rail, plan/source summaries, and the optional Context/Evidence inspector |
| `frontend/src/features/models/` | Model metadata/search helpers and browser-local favorite/recent preferences |
| `frontend/src/features/assistants/` | Browser-local assistant favorite and recent-launch preferences |
| `frontend/src/features/knowledge/` | Searchable source-ledger editor and per-conversation knowledge-base binding UI |
| `frontend/src/features/tools/` | MCP connection registry, proposal builder, approval inbox, and audit timeline |
| `frontend/src/features/artifact-preview/` | Fenced-output classification, sandbox document policy, and responsive Chat preview pane |
| `frontend/src/hooks/` | Media-query behavior and persisted workspace UI preferences |
| `frontend/src/api/` | Backend-authoritative generated contracts, typed requests, and SSE streaming client |
| `src/files.py` | Shared document/image parsing and upload validation |
| `src/rag.py` | Existing Chroma collections and embedding retrieval |
| `src/ollama_client.py` | Shared Ollama discovery, health, and embedding helpers |
| `tests/` | Backend contracts, lifecycle, provider, safety, and workspace tests |
| `data/` | Local SQLite/Chroma runtime state |
| `Launch Chat Studio.cmd` | Portable Windows setup detection, installation, launch, and browser opening |
| `Launch Chat Studio.sh` | Equivalent cached setup, port recovery, launch, and browser opening for supported Linux desktops |

`chat-studio` starts `backend.app.cli:main` on `127.0.0.1:8506`. FastAPI serves
`frontend/dist` when it exists; Vite proxies `/api` to that same origin during
frontend development. The Settings **Stop Studio** control calls
`POST /api/v1/runtime/shutdown` with the `X-Local-Studio: shutdown` header.

The Streamlit entrypoint and `pages/` were removed after the React workspace moved to
the shared `data/app.db` schema. Older service modules under `src/` remain only where
they still provide shared parsing, Ollama, or Chroma behavior.
