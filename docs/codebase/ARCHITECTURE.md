# Architecture

```text
React workspace
  → FastAPI routes and session cookie
    → context preflight (policy, safety, selected attachments, retrieval, budget)
      → RunManager task → provider adapter → retained SSE events
        → SQLite messages/runs/receipts + optional Chroma retrieval
```

`create_app()` composes one legacy-compatible `Store`, session credential vault,
provider registry, and run manager. Preflight produces a hash-bound context plan. A
turn is accepted only when the plan still matches and required safety findings were
confirmed. Exact web evidence is cached by plan hash; individual sources can be
excluded.

Runs are persisted to SQLite and also retained in memory while the process lives so
SSE subscribers can replay events and follow new deltas. Run IDs are scoped to the
owning browser session. Completed runs append assistant messages and chained receipt
hashes.

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
