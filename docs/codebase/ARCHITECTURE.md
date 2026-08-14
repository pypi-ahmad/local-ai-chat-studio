# Architecture

```text
React workspace
  → FastAPI routes and session cookie
    → context preflight (policy, safety, selected attachments, bound knowledge base, retrieval, budget)
      → RunManager task → provider adapter → retained SSE events
        → SQLite messages/runs/receipts + optional Chroma retrieval
```

`create_app()` composes one legacy-compatible `Store`, session credential vault,
provider registry, and run manager. Preflight produces a hash-bound context plan. A
turn is accepted only when the plan still matches and required safety findings were
confirmed. Exact web evidence is cached by plan hash; individual sources can be
excluded. The frontend derives utilization and remaining or excess tokens from the
plan's estimated and safe-budget totals. It blocks submission while a plan remains
over budget. When requested, the backend locally compresses older history into a
deterministic summary, retains the latest eight messages verbatim, and includes the
summary source and compressed count in the hash-bound plan.

Conversation generation settings are stored as a validated JSON snapshot beside the
conversation row. Chat hydrates that snapshot when the active conversation changes
and debounces updates through the existing PATCH endpoint. System prompts flow into
preflight estimation, the plan hash, assembled messages, and replay data. Branches
copy settings at creation and remain independent afterward.
Library assistants pass the same snapshot during conversation creation, so the
preset's model, temperature, and system prompt are committed atomically. Favorite
and recent assistant IDs stay in browser storage and do not alter preset records.
Library knowledge bases also use that snapshot: `knowledge_base_id` binds at most one
base to a conversation. The base stores ordered references to files, active memories,
and backpacks, plus a switch for related-chat retrieval. Preflight expands those
references at send time, scans the complete source text, applies provider source
policies, and exposes each approved item under a separate `knowledge` section. Source
records remain authoritative; deleting a base only unbinds conversations.

Runs are persisted to SQLite and also retained in memory while the process lives so
SSE subscribers can replay events and follow new deltas. Run IDs are scoped to the
owning browser session. Completed runs append assistant messages and chained receipt
hashes.

Transcript exports read the persisted conversation and serialize it as Markdown,
plain text, structured JSON, or escaped standalone HTML. Reproducibility export is a
separate run artifact: Chat selects the newest completed run for the active
conversation, then uses the existing session-owned bundle endpoint. This keeps run
request/context data out of ordinary transcript formats and prevents cross-chat bundle
selection.

The Compare workspace fans one prompt out to two to four ordinary runs concurrently.
Each result retains its own status, output, and safe error; one failed provider does not
stop the others. **Cancel all** aborts each browser stream and cancels every created run
through the existing session-owned run endpoint.

Rich message fences can emit a typed client-side artifact. Chat stores only the current
selection in temporary React state and lays its transcript beside a preview pane.
HTML, SVG, and Mermaid output cross a unique-origin, scriptless iframe boundary with a
restrictive CSP; code is displayed as escaped source. Artifact preview does not alter
messages, runs, exports, or the backend contract.

FastAPI serves `frontend/dist` at `/`. Shared helpers under `src/` provide file parsing,
Ollama health/embeddings, and the existing `data/chroma` collections.

Memory extraction is separate from normal turn assembly. On an explicit **Save memories
& close** action, the selected model first extracts candidates from the full chat and
then consolidates them against existing memories. SQLite commits the accepted batch and
the conversation extraction timestamp together; active memories are mirrored to Chroma
only when an embedding model is configured. Provenance stays with the SQLite record.

Provider adapters separate Ollama Local from Ollama Cloud. OpenCode is a loopback-only
server bridge: it owns upstream OAuth and streaming sessions, while this app continues
to apply remote-provider context policy before sending chat context to it.

After model discovery, `ProviderRegistry` attaches optional `ModelPricing` metadata.
The pricing catalog is source-linked and dated; OpenRouter pricing is read from its
live model payload. Preflight token estimates are multiplied by the selected model's
standard input rate in the browser. Pricing is presentation metadata and does not
alter routing, billing, or provider requests.

The system is deliberately single-process and localhost-first. Horizontal scaling
would require external run events and credential/session state.

Managed shutdown is part of that single-process model. Settings **Stop Studio**
posts to `/api/v1/runtime/shutdown`, `RunManager.shutdown()` cancels and awaits
active generation tasks, then the CLI sets `uvicorn.Server.should_exit`. Process
lifespan performs the same run drain and closes SQLite. Ollama and OpenCode are
not stopped.
