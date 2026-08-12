# External Integrations

| Integration | Purpose | Credentials |
|---|---|---|
| Ollama | Local/remote chat, discovery, vision, health, embeddings | Optional bearer key |
| OpenAI / xAI / OmniRoute | OpenAI-compatible discovery, chat, vision | Session key or env fallback |
| Anthropic | Discovery, chat, vision | Session key or env fallback |
| Google Gemini | Discovery, chat, vision | Session key or env fallback |
| OpenRouter | Discovery/chat plus PKCE sign-in | Session key, env, or exchanged key |
| DuckDuckGo via DDGS | Opt-in web evidence | No key |
| antiword / LibreOffice | Optional old `.doc` conversion | Local executable |

Cloud context starts prompt-only and is expanded per provider policy. Browser-entered
keys live in the session vault, are never written to SQLite, and are cleared on panic
wipe or restart. Provider errors are reduced before they reach run events.

Canonical data is `data/app.db`; vector collections are `data/chroma`. A previous
`data/v2/studio.db` is imported only on explicit confirmation after a SQLite backup.
