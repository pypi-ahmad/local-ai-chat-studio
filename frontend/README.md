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

The Compare workspace lets users choose two to four distinct discovered models and
starts one run per model concurrently. Result cards stream and fail independently;
**Cancel all** aborts each stream and cancels every created run. Keep the selection
limit, duplicate prevention, provider-charge warning, and focused Vitest coverage when
changing this surface.
