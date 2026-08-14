# External Integrations

| Integration | Purpose | Credentials |
|---|---|---|
| Ollama Local | Local chat, discovery, vision, health, embeddings | No key; `CHAT_OLLAMA_HOST` defaults to `http://localhost:11434` |
| Ollama Cloud | Cloud chat and discovery | `OLLAMA_API_KEY` session key or environment fallback |
| OpenAI / xAI / OmniRoute | OpenAI-compatible discovery, chat, vision | Session key or env fallback; `OPENAI_BASE_URL` optionally overrides OpenAI |
| Agnes AI | OpenAI-compatible [`agnes-2.5-flash`](https://www.agnes-ai.com/en/docs/agnes-25-flash) discovery and chat ([overview](https://www.agnes-ai.com/en/docs/overview)) | `AGNES_API_KEY` session key or environment fallback |
| Anthropic | Discovery, chat, vision | Session key, env fallback, or workload identity |
| Google Gemini | Discovery, chat, vision | Session key or env fallback |
| OpenRouter | Discovery/chat plus PKCE sign-in | Session key, env, or exchanged key |
| OpenCode server | Connected-provider discovery and chat; dynamically exposed OAuth methods such as ChatGPT, SuperGrok, or Claude | Upstream OAuth through a loopback-only bridge |
| OpenCode Zen / Go | Discovery and chat | Session key or env fallback |
| DuckDuckGo via DDGS | Opt-in web evidence | No key |
| antiword / LibreOffice | Optional old `.doc` conversion | Local executable |
| Model Context Protocol | User-approved local stdio or public HTTPS tools | Named environment variables only; values are resolved at process launch |

Cloud context starts prompt-only and is expanded per provider policy. Browser-entered
keys live in the session vault, are never written to SQLite, and are cleared on panic
wipe or restart. Provider errors are reduced before they reach run events.

OpenAI-compatible requests normally carry the selected temperature.
`gpt-5.6-luna` is the narrow exception: its endpoint supports only the model default,
so the adapter omits that parameter. Parallel comparison still creates ordinary,
independently cancellable requests; selecting multiple cloud models sends the prompt
to every selected provider and may incur a charge from each one.

## OpenCode bridge

The application connects only to an HTTP loopback OpenCode server. Configure
`OPENCODE_SERVER_URL` when it is not `http://127.0.0.1:4096`; optional basic-auth
credentials use `OPENCODE_SERVER_USERNAME` and `OPENCODE_SERVER_PASSWORD`. The
Providers page lists only OAuth methods that the running server reports, then lets the
server complete the upstream flow. A local bridge is not treated as a local model:
connected upstream providers still follow the remote-context policy.

## Model Context Protocol

The Tools workspace accepts allowlisted stdio executable names and public HTTPS
Streamable HTTP URLs. Registration never connects. Explicit discovery stores each
tool's JSON input schema, and proposed calls are validated before they enter a
session-scoped approval queue. Approval is single-use; denial never contacts the tool.
Local subprocesses receive no shell, use `data/mcp-sandboxes/<server-id>` as their
working directory, and inherit only basic runtime variables plus explicitly named
environment keys. Values, raw terminal arguments, and unbounded output are not exposed
in the audit API. These restrictions reduce risk but do not constitute an OS sandbox.

## Pricing metadata

Discovered models may carry dated `ModelPricing` metadata from
`backend/app/pricing.py`. Direct-provider entries use official pricing pages;
OpenRouter uses the pricing object returned by its Models API. The provider-scoped
React model picker searches names, IDs, and reported capabilities; it can filter for
vision, tool-use, or reasoning support and shows provider marks, context length,
reasoning levels, and input/output rates. Favorites and the six most recent choices
are browser-local preferences. The preflight rail estimates input cost. Custom endpoints,
subscription routes, and unknown models remain unpriced rather than inheriting a
possibly incorrect vendor rate. Estimates omit output, caching, tools, media,
discounts, taxes, and subscription charges.

## Attachments and memory

Conversation settings stay in local SQLite and travel only through the local API.
The selected system prompt becomes the first provider message for that conversation;
an empty prompt uses the built-in default. Model, effort, temperature, context policy,
web/compression flags, and layout remain isolated between conversations.

Uploads stay local until explicitly selected for a turn. Chat represents each file as
an uploading, ready, or failed card. Successful new uploads are selected for the next
message; failed cards retain a safe server error and can be retried or removed without
leaving the composer. Preflight validates selected IDs against the active conversation
and rejects image input for a model that explicitly reports no vision support. Files
are parsed locally; images are validated with Pillow and PDF uploads require a valid
PDF signature.

SQLite (`data/app.db`) is the canonical memory store. **Save memories & close** sends
the full transcript to the selected model to extract short, durable, user-grounded
facts, preferences, goals, constraints, decisions, and project context. Each saved
memory records source message IDs, the selecting provider/model, and a reason. Remote
extraction requires confirmation; secret/PII candidates are discarded and suspected
prompt-injection candidates are quarantined. Chroma is an optional retrieval index
when `CHAT_EMBED_MODEL` is configured.

Canonical data is `data/app.db`; vector collections are `data/chroma`. A previous
`data/v2/studio.db` is imported only on explicit confirmation after a SQLite backup.
