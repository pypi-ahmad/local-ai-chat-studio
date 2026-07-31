# Security Policy

## Scope

Local AI Chat Studio is a **local-first** app: it has no server component of ours,
no telemetry, and no accounts. The security-relevant surfaces are:

- **API keys** — held in process memory only for the session, never written to
  disk or logs, sent only to the provider they belong to (`src/providers.py`).
- **Local data** — chats, memories, and vectors in `data/` (SQLite + ChromaDB),
  protected by your OS file permissions.
- **Network exposure** — the app ships with no authentication. Do not expose it
  beyond `localhost` on untrusted networks.
- **Prompt injection** — web search results and uploaded documents are inserted
  into the model's context unsanitized (`src/orchestrator.py`, `src/jobs.py`).
  A malicious page or file could contain text designed to steer the assistant's
  reply. Since replies only ever render as plain text/Markdown (no `eval`,
  `innerHTML`, or shell execution of model output), the ceiling of this is
  misleading assistant output, not code execution — but treat any instruction
  that appears to originate from retrieved content, not you, with suspicion.

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
