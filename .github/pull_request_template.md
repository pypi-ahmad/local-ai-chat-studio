## What does this PR do?

<!-- One or two sentences: the *why* and the *what*. Link the related issue below. -->

Closes #

---

## Changes

<!-- List the concrete changes, one per bullet. Be specific about files or components touched. -->

-

## How was it tested?

<!-- Describe the end-to-end verification you did in the running app:
     - Which model / provider did you test with?
     - What steps did you click through?
     - What did you observe?
     Unit tests alone are not sufficient — the app needs to be run. -->

## Checklist

- [ ] Focused on one topic (bug fix / feature / docs — not a mixed bag)
- [ ] Verified end-to-end in the running app, not just unit tests
- [ ] Python: type hints on new public functions; no `print` debugging
- [ ] TypeScript/React: new UI lives in the correct layer (`routes/`, `features/`, `components/`, `api/`)
- [ ] Docs updated if user-visible behaviour, configuration, or API contracts changed
- [ ] If `backend/app/contracts.py` changed: ran `npm run generate:api` from `frontend/`, removed root `openapi.json`, committed updated `frontend/src/api/schema.ts`
- [ ] Tests added or updated: backend under `tests/`, frontend beside the relevant route or feature
- [ ] No hardcoded model names; no credentials or real API keys anywhere in the diff
- [ ] `backend/app/pricing.py` changes (if any) cite official source URL and date
