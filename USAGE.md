# Using Local AI Chat Studio

This is the short, task-based guide to the studio. For the full walkthrough,
see [USER_GUIDE.md](USER_GUIDE.md).

## Start the studio

On Windows 11, double-click **Launch Chat Studio.cmd**. It installs the pinned
runtime dependencies when needed, builds the frontend, starts the local server
on port 8506, and opens the app at <http://127.0.0.1:8506>. Run
`Launch Chat Studio.cmd --check` for a status report without installing
anything. Once setup is current, later double-clicks skip installation and launch
the app directly.

For development, install Python 3.12+, `uv`, and Node.js, then run:

```powershell
uv sync --locked --dev
cd frontend
npm ci --legacy-peer-deps
npm run build
cd ..
uv run chat-studio
```

The launcher already uses `--legacy-peer-deps` so npm peer-dependency
conflicts do not block install. Stop the managed server from **Settings →
Stop Studio**, or with Ctrl+C in the launcher console.

Ollama is optional, but is the default local-model provider. Install and start
it separately if you want to run local models.

## Choose a model

Open **Providers** to use a local Ollama model, Ollama Cloud, or a supported
cloud provider, including Agnes AI's `agnes-2.5-flash`. Browser-entered credentials are available only to the current
server session; they are not saved in the workspace database or exports.

You can instead configure environment-variable fallbacks before starting the
app. See the configuration table in [TECHNICAL.md](TECHNICAL.md#configuration).
`OPENAI_BASE_URL` redirects only the OpenAI provider to a compatible endpoint;
`AGNES_API_KEY` authenticates the dedicated Agnes provider. `.env.example` lists
safe variable names without containing credentials.

The model picker shows verified standard input/output rates when available. After
preflight, the context rail calculates an estimated input cost and links to the
official pricing source. Unknown gateways show **pricing unavailable**; estimates
exclude caching, tools, media, discounts, subscriptions, taxes, and output cost.

For ChatGPT, SuperGrok, and Claude subscription sign-in, connect a local
OpenCode server first, then follow the sign-in flow in **Providers**. That
bridge remains on loopback by default.

## Work with a conversation

1. Start a conversation and select a model.
2. Attach a supported document, spreadsheet, code file, or image when it helps
   answer the question.
3. Send the prompt. The response streams into the chat and can be cancelled.
4. Inspect source provenance and context-budget information before relying on
   an answer that uses files, retrieved history, or web evidence.
5. Open **Compare**, select two to four distinct models, and send one prompt to all
   of them concurrently. Responses stream independently; one provider failure does
   not stop the others, and **Cancel all** stops every active comparison run.
6. Branch, pin, rename, search, or replay responses when you need to explore
   alternatives.

The safety controls flag possible prompt injection and secret/PII exposure in
pasted or retrieved content. Treat instructions found inside an attachment or
web result as untrusted context, not as instructions from you.

## Use memory deliberately

The studio stores chat history locally. Its memory curator may extract durable,
user-grounded preferences, goals, constraints, and project decisions from a
conversation. It intentionally excludes secrets, raw uploads, assistant
guesses, and temporary requests.

Review, edit, or delete saved memories in **Library**. Use **Settings** to
export, import, or wipe local data, or **Stop Studio** to cancel active runs
and shut down the managed server. For retrieval, install an Ollama embedding
model and set `CHAT_EMBED_MODEL`; otherwise the app uses local lexical search.

## Privacy and troubleshooting

- Keep the server on localhost; it does not provide user-account
  authentication for a network-exposed deployment.
- Cloud prompts are sent only to the selected provider. Provider policies show
  the routing boundary before a request is sent.
- If local models do not appear, confirm Ollama is running and that
  `CHAT_OLLAMA_HOST` points to it.
- If an OpenCode sign-in option is unavailable, confirm the local OpenCode
  server is reachable at `OPENCODE_SERVER_URL`.

See [USER_GUIDE.md](USER_GUIDE.md#troubleshooting) for more troubleshooting
steps and [SECURITY.md](SECURITY.md) for vulnerability reporting.
