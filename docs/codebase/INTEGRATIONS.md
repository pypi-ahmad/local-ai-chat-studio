# External Integrations

## 1) Integration Inventory

| System | Type | Purpose | Auth model | Criticality | Evidence |
|--------|------|---------|------------|-------------|----------|
| Ollama local/remote/cloud | Model API | Model discovery, chat, embeddings, vision, health | Optional bearer key | High | `src/ollama_client.py`, `backend/app/providers.py` |
| OpenAI | Model API | BYOK model discovery and streaming chat | API key | High | `src/providers.py`, `backend/app/providers.py` |
| Anthropic | Model API | BYOK model discovery and streaming chat | API key | High | `src/providers.py`, `backend/app/providers.py` |
| Google Gemini | Model API | BYOK model discovery and streaming chat | API key | High | `src/providers.py`, `backend/app/providers.py` |
| OpenRouter | Gateway API + OAuth | Model catalog/chat and localhost PKCE key exchange | API key or PKCE | High | `src/providers.py`, `backend/app/main.py` |
| xAI | OpenAI-compatible API | BYOK model discovery and streaming chat | API key | Medium | `src/providers.py`, `backend/app/providers.py` |
| OmniRoute | Local OpenAI-compatible gateway | v2 model discovery and streaming chat | Optional configured key | Medium | `backend/app/providers.py`, `backend/app/sessions.py` |
| DuckDuckGo via DDGS | Search API/library | Optional web-search context | No key | Medium | `src/jobs.py` |
| antiword / LibreOffice | Local subprocess | Legacy `.doc` text extraction | OS executable | Low | `src/files.py` |

There is no message queue, service mesh, external authentication/account service, or hosted project backend.

## 2) Data Stores

| Store | Role | Access layer | Key risk | Evidence |
|-------|------|--------------|----------|----------|
| SQLite `data/app.db` | Legacy chats, messages, memories, feedback, presets, profile KV | `src/chat_store.py` | Hand-written lightweight migration and no schema-version table | `src/config.py`, `src/chat_store.py` |
| ChromaDB `data/chroma` | Legacy document, history, and memory vectors | `src/rag.py` | Global persistent client and embedding-model compatibility is not recorded | `src/rag.py` |
| SQLite `data/v2/studio.db` | v2 conversations/messages; schema also declares runs | `backend/app/store.py` | Separate from legacy data; run rows are not used | `backend/app/main.py`, `backend/app/store.py` |
| Process memory | Credentials, legacy jobs, v2 runs/events, OAuth verifiers | `src/providers.py`, `backend/app/sessions.py`, `backend/app/runs.py` | Lost on restart and not shareable across processes | respective modules |

## 3) Secrets and Credentials Handling

- UI-entered keys are held in guarded process-memory dictionaries; environment variables are read-only fallbacks.
- v2 keys are keyed by the `chat_session` cookie; legacy `src/providers.py` uses one process-global secret map.
- OpenRouter PKCE verifiers and exchanged keys are held in memory.
- No committed hardcoded API keys were found in the provider/config modules; only public endpoints and environment-variable names are hardcoded.
- Restarting the process clears in-memory keys. There is no secret rotation or expiry subsystem.

## 4) Reliability and Failure Behavior

- Legacy Ollama uses configurable `CHAT_REQUEST_TIMEOUT` (default 300 seconds); OpenRouter/model-list calls and OAuth exchange use 30-second timeouts; `.doc` subprocesses use 30/60 seconds.
- v2 OpenRouter exchange uses a 30-second timeout. Other SDK calls use SDK defaults in the shown code.
- Legacy web search returns an empty result on failure; v2 provider discovery returns per-provider error objects.
- No application-level retry, exponential backoff, circuit breaker, or provider failover is implemented.
- Legacy and v2 cancellation flags are cooperative; they do not necessarily interrupt a provider call that has not yielded.

## 5) Observability for Integrations

- Legacy integration failures use local Loguru warnings/exceptions and user-facing friendly errors.
- v2 records error text in run snapshots/events but has no explicit metrics, tracing, or structured integration logger.
- Streamlit usage telemetry is disabled in `.streamlit/config.toml`; the README states there is no application telemetry.
- Missing visibility: provider latency/error metrics, retrieval provenance, token/cost aggregation across providers, and durable run/audit records.

## 6) Evidence

- `src/providers.py`
- `src/ollama_client.py`
- `src/jobs.py`
- `src/chat_store.py`
- `src/rag.py`
- `backend/app/providers.py`
- `backend/app/sessions.py`
- `.streamlit/config.toml`
