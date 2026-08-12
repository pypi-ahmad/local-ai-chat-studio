# Codebase Concerns

## Current constraints

- The app is intentionally a single-process, localhost workspace. Active run tasks and
  browser-entered credentials are process memory, so a restart ends them.
- There is no user authentication. Do not expose the server to an untrusted network.
- Provider discovery depends on remote SDK calls; one slow catalog can delay the model
  list even though failures degrade per provider.
- SQLite text search uses `LIKE`; add FTS only after profiling a realistically large
  history.
- Chroma retrieval requires `CHAT_EMBED_MODEL`; otherwise the app uses lexical history
  retrieval.
- The documentation site renderer still needs a separate raw-HTML sanitization audit.

## Protected boundaries

- Run read, event, and cancellation endpoints require the owning browser session.
- Remote providers default to prompt-only context.
- Retrieved instruction overrides are quarantined; secrets and PII pause sends.
- Full replay bundles are local artifacts; redacted bundles remove private context and
  image bytes.
- Provider exceptions are reduced to safe error categories before reaching clients.

## Change strategy

Keep provider adapters contract-tested, regenerate `frontend/src/api/schema.ts` after
contract changes, and make schema evolution explicit in `schema_migrations`. Treat
`backend/app/main.py`, `runs.py`, `store.py`, and `workspace.py` as high-blast-radius
files and require focused lifecycle tests for edits.
