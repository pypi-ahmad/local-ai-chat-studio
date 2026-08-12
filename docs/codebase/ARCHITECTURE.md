# Architecture

```text
React workspace
  → FastAPI routes and session cookie
    → context preflight (policy, safety, retrieval, budget)
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

The system is deliberately single-process and localhost-first. Horizontal scaling
would require external run events and credential/session state.
