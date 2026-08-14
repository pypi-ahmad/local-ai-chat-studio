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
