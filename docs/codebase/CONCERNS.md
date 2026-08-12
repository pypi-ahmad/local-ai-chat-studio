# Codebase Concerns

## 1) Top Risks (Prioritized)

| Severity | Concern | Evidence | Impact | Suggested action |
|----------|---------|----------|--------|------------------|
| High | The documented v2 start path serves a React shell whose Send/Configure actions do not call the API | `README.md`, `frontend/src/App.tsx`, `frontend/src/api/client.ts` | Users following the primary startup instructions cannot complete the core chat flow in React | Wire the shell to conversations/runs/SSE or document Streamlit as the functional default until parity |
| High | Cancellation is cooperative and checked only after a provider yields | `backend/app/runs.py`, `src/jobs.py` | A hung provider call can remain active after Stop/DELETE | Retain/cancel the actual task/stream and add stalled-stream tests |
| Medium | v2 run retrieval/events/cancellation do not verify the requesting session | `backend/app/main.py`, `backend/app/runs.py` | A client possessing a run UUID can read or cancel another session's run | Store run ownership and require matching `request.state.session_id` |
| Medium | Two stacks duplicate providers, credentials, stores, and execution behavior | `src/`, `backend/app/` | Divergent fixes, security posture, and user data | Define the parity/retirement plan and consolidate shared contracts/services |
| Medium | Documentation Markdown is rendered through unsanitized `innerHTML` | `docs/site/index.html` | Malicious raw HTML in a contributed Markdown file can execute in a viewer's browser | Sanitize `marked` output or disable raw HTML |
| Medium | Retrieved documents and web results enter prompts without instruction isolation | `SECURITY.md`, `src/jobs.py`, `src/orchestrator.py` | Prompt injection can steer model answers | Label untrusted context, add provenance, and test adversarial retrieval |

## 2) Technical Debt

The repository scan found no `TODO`, `FIXME`, or `HACK` markers in handwritten production code. The debt below is inferred from implemented behavior and repository structure rather than inline markers.

| Debt item | Why it exists | Where | Risk if ignored | Suggested fix |
|-----------|---------------|-------|-----------------|---------------|
| Separate legacy/v2 data models | Incremental rewrite/parity window | `src/chat_store.py`, `backend/app/store.py` | Data fragmentation and migration ambiguity | Define a canonical schema and migration path |
| Declared but unused v2 `runs` table | Run implementation is in-memory | `backend/app/store.py`, `backend/app/runs.py` | Misleading durability expectations | Persist runs or remove the unused schema after intent is decided |
| Generic frontend README | Vite scaffold was retained | `frontend/README.md` | New contributors miss project-specific setup and boundaries | Replace it with local architecture and commands |
| OpenAPI drift is manual | Type generation is a contributor step only | `scripts/generate_api_types.py`, `.github/workflows/ci.yml` | Backend/frontend contracts can silently diverge | Regenerate in CI and fail on a dirty diff |
| Legacy Python outside Ruff/pytest coverage | Tests/CI were introduced for v2 first | `.github/workflows/ci.yml`, `src/`, `app.py` | Mature behavior can regress unnoticed | Add targeted legacy tests and expand lint incrementally |
| Lightweight SQLite migration | Only one caught `ALTER TABLE` is used | `src/chat_store.py` | Future schema evolution becomes fragile | Add explicit schema versions/migrations before more changes |

## 3) Security Concerns

| Risk | OWASP category | Evidence | Current mitigation | Gap |
|------|----------------|----------|--------------------|-----|
| No application authentication | A01 Broken Access Control | `README.md`, `SECURITY.md`, `backend/app/main.py` | Servers bind to localhost by default; docs warn against untrusted exposure | No passcode/auth if exposed on LAN |
| Run endpoints lack session ownership | A01 Broken Access Control | `backend/app/main.py` | UUID run identifiers are hard to guess | No authorization check once an ID is known |
| Unsanitized docs rendering | A03 Injection | `docs/site/index.html` | Markdown sources are repository-local | Raw HTML/event handlers are not sanitized |
| Prompt injection through retrieval | LLM prompt injection | `src/jobs.py`, `src/orchestrator.py`, `SECURITY.md` | Security policy documents the risk; model output is not executed as code | No quarantine, instruction boundary, or provenance inspection UI |
| Process-memory secret retention | N/A | `src/providers.py`, `backend/app/sessions.py` | Keys are not written to disk and can be forgotten/restarted away | No TTL; legacy keys are process-global rather than browser-session isolated |
| Raw provider errors reach responses/events | N/A | `backend/app/providers.py`, `backend/app/runs.py` | Keys are not intentionally included | No centralized redaction or safe error taxonomy |

## 4) Performance and Scaling Concerns

| Concern | Evidence | Current symptom | Scaling risk | Suggested improvement |
|---------|----------|-----------------|-------------|-----------------------|
| Single-process in-memory jobs/runs/sessions | `src/jobs.py`, `backend/app/runs.py`, `backend/app/sessions.py` | State disappears on restart | Multiple workers cannot share state or credentials | Keep single-process as an explicit constraint or externalize state |
| Legacy full-text search uses `%query%` joins | `src/chat_store.py:search_conversations` | Full scans as messages grow | Sidebar search latency grows with database size | Add SQLite FTS if profiling shows need |
| Provider discovery awaits all adapters | `backend/app/providers.py` | Slowest provider controls endpoint completion | A hung SDK can delay the full model catalog | Add per-provider timeouts and return partial results promptly |
| Prompt assembly performs multiple embedding/vector calls per turn | `src/orchestrator.py`, `src/memory.py`, `src/rag.py` | Latency before generation | Larger memory/history indexes increase prefill delay | Measure phases, cache query embeddings, and expose timings |
| Large source hubs | `app.py`, `src/jobs.py`, `src/chat_store.py`, `backend/app/main.py` | Wide change blast radius | Harder testing and review as parity work grows | Refactor only along tested lifecycle/data boundaries |

## 5) Fragile/High-Churn Areas

| Area | Why fragile | Churn signal | Safe change strategy |
|------|-------------|-------------|----------------------|
| `README.md` | Mixes legacy capabilities with v2 startup/architecture claims | 13 commits in the scan's 90-day history | Verify every product claim against both stacks |
| `app.py` | Large Streamlit composition root with UI and state transitions | 7 commits; 577 lines | Add behavior tests before decomposing handlers/rendering |
| `src/jobs.py` | Central generation, files, search, RAG, cancellation, persistence | 5 commits; CodeGraph hub | Test lifecycle phases and error/cancel paths before edits |
| `src/providers.py`, `src/ollama_client.py` | External API compatibility and credential handling | 4 commits each | Use adapter contract tests and never log credentials |
| `backend/app/main.py`, `backend/app/runs.py` | v2 routes, sessions, OAuth, SSE, run state | New high-connectivity modules | Add failure/ownership tests around every change |

## 6) `[ASK USER]` Questions

1. [ASK USER] Is FastAPI/React intended to be the current user-facing default, or should Streamlit remain the documented default until React chat/provider flows are wired?
2. [ASK USER] Should v2 migrate/share `data/app.db` and Chroma memory, or intentionally start with a separate `data/v2/studio.db`?
3. [ASK USER] Is the local server strictly single-user, or must conversations and runs be isolated between browser sessions?
4. [ASK USER] After parity, should the legacy Streamlit stack be removed, kept as an alternative UI, or maintained indefinitely?
5. [ASK USER] What Node.js versions and deployment modes are officially supported outside the Node 22.12 CI job?

## 7) Evidence

- `README.md`
- `SECURITY.md`
- `.github/workflows/ci.yml`
- `frontend/src/App.tsx`
- `src/jobs.py`
- `src/chat_store.py`
- `backend/app/main.py`
- `backend/app/runs.py`
- `docs/site/index.html`
- Terminal scans: `git log --since="90 days ago" --name-only`, production marker search, and source line counts
