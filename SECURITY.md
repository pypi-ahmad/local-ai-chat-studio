# Security Policy

## Scope

Local AI Chat Studio is a **local-first** FastAPI and React workspace: it has
no hosted service of ours, no telemetry, and no account layer. The
security-relevant surfaces are:

- **API keys and OAuth tokens** — browser-entered credentials are held in the
  server's in-memory session vault, never written to SQLite, exports, or logs,
  and sent only to the selected provider. Environment variables are optional
  local fallback credentials and must be protected by the operating system.
  `.env.example` contains only safe names and public endpoints; never put real
  credentials in that tracked example.
- **Local data** — chats, curated memories, uploads, and optional retrieval
  data live under `data/` by default (`app.db`, `chroma`, and uploads). They are
  protected by your OS file permissions and can be exported, imported, or wiped
  from the product.
- **Network exposure** — the launcher binds to `127.0.0.1:8506` and the app
  ships without a user-account layer. Do not expose it beyond localhost on an
  untrusted network.
- **Managed shutdown** — `POST /api/v1/runtime/shutdown` stops the process
  started by `chat-studio`. It requires the `X-Local-Studio: shutdown` header
  from the Studio UI and is unavailable in unmanaged/test servers. The route
  cancels active runs before Uvicorn exits; it does not stop Ollama or
  OpenCode.
- **Untrusted context** — uploaded documents, pasted text, retrieval results,
  and web evidence can contain prompt-injection attempts or sensitive text. The
  workspace provides warnings, quarantine, provenance, and redaction controls,
  but you should still treat instructions originating in that content as
  untrusted.
- **Parallel comparison** — Compare sends the same prompt independently to every
  selected model. Review the selected providers before running it: choosing multiple
  cloud models crosses each provider's data boundary and can incur separate charges.
  A failure is isolated to its result card, while **Cancel all** requests cancellation
  for every active run.
- **Local bridges** — OpenCode subscription flows use a loopback-only local
  server. Keep its optional credentials private and do not change the bridge to
  a public endpoint.

## Reporting a vulnerability

If you find a vulnerability (e.g. a path that persists or leaks a key, prompt
content reaching an unintended endpoint, or unsafe file parsing), please **do not
open a public issue**. Instead, use GitHub's
[private vulnerability reporting](https://github.com/pypi-ahmad/local-ai-chat-studio/security/advisories/new)
for this repository.

Please include reproduction steps and the commit hash. You can expect an
acknowledgement within a few days.

## Supported versions

Only the latest commit on `main` is supported.
