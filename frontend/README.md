# React workspace

```powershell
npm ci --legacy-peer-deps
npm run dev          # proxies /api to 127.0.0.1:8506
npm test
npm run lint
npm run build
npm run generate:api
```

`src/api/schema.ts` is generated from the FastAPI OpenAPI document. The root
`openapi.json` produced by generation is temporary and should not be committed.
Model discovery includes optional `ModelPricing` metadata. `App.tsx` displays
the published input/output rates and calculates preflight input-cost estimates;
unknown pricing must remain visibly unavailable.

The shared model picker is provider-scoped and searchable by name, ID, or
capability. Preserve its Vision/Reasoning filters and the displayed context length,
reasoning levels, capabilities, and pricing when changing model-discovery surfaces.
Chat, Compare, Replay, and assistant configuration use this contract.

Library presents saved presets as a searchable assistant gallery. Favorites and the
four most recent launches are browser-local preferences; **Start chat** sends the
preset settings with the conversation-create request so Chat opens fully configured.

Assistant output is rendered as CommonMark/GFM with tables, task lists,
syntax-highlighted copyable code, and KaTeX math; raw HTML must remain inert.
Fenced HTML, SVG, Mermaid, and code blocks expose a Chat-only artifact action. Keep
renderable output inside the scriptless `sandbox=""` iframe produced by
`features/artifact-preview/sandboxDocument.ts`; never inject model output into the
host DOM. Code preview remains escaped source, and the workbench stacks responsively.
Attachments expose Uploading/Ready/Failed cards with retry and removal. Chat also
owns saved-message navigation, exact context utilization/overflow warnings, grouped
desktop/mobile navigation, and a persisted optional Context/Evidence inspector.
Keep these behaviors covered by focused Vitest tests.

Chat settings are conversation-owned, not global UI preferences. Loading a
conversation hydrates its model, effort, temperature, context policy, web/compression
flags, system prompt, and message layout. Changes are saved through
`PATCH /api/v1/conversations/{id}`; keep hydration and save isolation covered when
changing the composer or Chat header.

The Chat header exports the active transcript through the typed conversation-export
client as Markdown, standalone escaped HTML, TXT, or JSON. Its reproducibility item
must remain scoped to the newest completed activity record whose `conversation_id`
matches the active conversation; the Runs drawer remains the place for choosing a
different run or a redacted bundle.

The Compare workspace lets users choose two to four distinct discovered models and
starts one run per model concurrently. Result cards stream and fail independently;
**Cancel all** aborts each stream and cancels every created run. Keep the selection
limit, duplicate prevention, provider-charge warning, and focused Vitest coverage when
changing this surface.
