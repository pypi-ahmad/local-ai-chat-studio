# External Integrations

| Integration | Purpose | Credentials |
|---|---|---|
| Ollama Local | Local chat, discovery, vision, health, embeddings | No key; `CHAT_OLLAMA_HOST` defaults to `http://localhost:11434` |
| Ollama Cloud | Cloud chat and discovery | `OLLAMA_API_KEY` session key or environment fallback |
| OpenAI / xAI / OmniRoute | OpenAI-compatible discovery, chat, vision | Session key or env fallback |
| Anthropic | Discovery, chat, vision | Session key, env fallback, or workload identity |
| Google Gemini | Discovery, chat, vision | Session key or env fallback |
| OpenRouter | Discovery/chat plus PKCE sign-in | Session key, env, or exchanged key |
| OpenCode server | Connected-provider discovery and chat; dynamically exposed OAuth methods such as ChatGPT, SuperGrok, or Claude | Upstream OAuth through a loopback-only bridge |
| OpenCode Zen / Go | Discovery and chat | Session key or env fallback |
| DuckDuckGo via DDGS | Opt-in web evidence | No key |
| antiword / LibreOffice | Optional old `.doc` conversion | Local executable |

Cloud context starts prompt-only and is expanded per provider policy. Browser-entered
keys live in the session vault, are never written to SQLite, and are cleared on panic
wipe or restart. Provider errors are reduced before they reach run events.

## OpenCode bridge

The application connects only to an HTTP loopback OpenCode server. Configure
`OPENCODE_SERVER_URL` when it is not `http://127.0.0.1:4096`; optional basic-auth
credentials use `OPENCODE_SERVER_USERNAME` and `OPENCODE_SERVER_PASSWORD`. The
Providers page lists only OAuth methods that the running server reports, then lets the
server complete the upstream flow. A local bridge is not treated as a local model:
connected upstream providers still follow the remote-context policy.

## Attachments and memory

Uploads stay local until explicitly selected for a turn. Preflight validates selected
IDs against the active conversation and rejects image input for a model that explicitly
reports no vision support. Files are parsed locally; images are validated with Pillow
and PDF uploads require a valid PDF signature.

SQLite (`data/app.db`) is the canonical memory store. **Save memories & close** sends
the full transcript to the selected model to extract short, durable, user-grounded
facts, preferences, goals, constraints, decisions, and project context. Each saved
memory records source message IDs, the selecting provider/model, and a reason. Remote
extraction requires confirmation; secret/PII candidates are discarded and suspected
prompt-injection candidates are quarantined. Chroma is an optional retrieval index
when `CHAT_EMBED_MODEL` is configured.

Canonical data is `data/app.db`; vector collections are `data/chroma`. A previous
`data/v2/studio.db` is imported only on explicit confirmation after a SQLite backup.
