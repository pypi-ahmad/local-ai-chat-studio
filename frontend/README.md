# React workspace

```powershell
npm ci
npm run dev          # proxies /api to 127.0.0.1:8000
npm test
npm run lint
npm run build
npm run generate:api
```

`src/api/schema.ts` is generated from the FastAPI OpenAPI document. The root
`openapi.json` produced by generation is temporary and should not be committed.
