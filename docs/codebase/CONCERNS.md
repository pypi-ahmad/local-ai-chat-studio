# Codebase Concerns

## Current constraints

- The app is intentionally a single-process, localhost workspace. Active run tasks and
  browser-entered credentials are process memory, so a restart ends them. Managed
  shutdown is available only when the process is started through `chat-studio`.
- There is no user authentication. Do not expose the server to an untrusted network.
- Provider discovery depends on remote SDK calls; one slow catalog can delay the model
  list even though failures degrade per provider.
- Cost figures are estimates from dated standard text-token rates. They do not include
  output usage, cache tiers, tools, media, discounts, tax, or subscription billing;
  custom and unknown gateways intentionally show no price.
- Compare sends the prompt independently to every selected model. Two to four cloud
  selections can therefore multiply spend and rate-limit pressure; the UI shows a
  charge warning and provides **Cancel all**, but providers may still bill completed
  tokens.
- SQLite text search uses `LIKE`; add FTS only after profiling a realistically large
  history.
- Chroma retrieval requires `CHAT_EMBED_MODEL`; otherwise the app uses lexical history
  retrieval.
- Full-chat memory extraction uses the selected LLM. It is deliberately explicit and
  requires confirmation for every remote provider, including an OpenCode bridge.
- OpenCode capabilities and upstream OAuth methods depend on the locally running server;
  the app intentionally does not proxy OpenCode over a remote network address.
- The documentation site renderer still needs a separate raw-HTML sanitization audit.

## Protected boundaries

- Run read, event, and cancellation endpoints require the owning browser session.
- Remote providers default to prompt-only context.
- Uploads are conversation-scoped and are sent only when selected for that individual
  turn. Image input is blocked when a model explicitly reports no vision capability.
- Retrieved instruction overrides are quarantined; secrets and PII pause sends.
- Memory candidates preserve user-message provenance; secrets/PII are discarded and
  prompt-injection-like content is quarantined before persistence.
- Full replay bundles are local artifacts; redacted bundles remove private context and
  image bytes.
- Standalone conversation HTML escapes every persisted title, model, role, and message
  value and includes a restrictive CSP; keep stored-XSS coverage whenever export
  rendering changes.
- Provider exceptions are reduced to safe error categories before reaching clients.

## Change strategy

Keep provider adapters contract-tested, regenerate `frontend/src/api/schema.ts` after
contract changes, and make schema evolution explicit in `schema_migrations`. Treat
`backend/app/main.py`, `runs.py`, `store.py`, and `workspace.py` as high-blast-radius
files and require focused lifecycle tests for edits.
