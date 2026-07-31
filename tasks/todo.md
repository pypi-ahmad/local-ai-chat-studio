# Todo: Multipage htmx Documentation Site

See `tasks/plan.md` for full detail, acceptance criteria, and rationale.

## Phase 1: Shell
- [x] Task 1: htmx shell + Markdown rendering (`docs/site/index.html`)
- [x] Task 2: Navigation + hash routing for all curated docs (grew to 10: added CODE_TUTORIAL.md and CONTRIBUTING.md, written after this plan)

### Checkpoint: Phase 1
- [x] Every curated doc renders correctly (tables, fenced code, images, badges) — verified in a real browser (Playwright)
- [x] Back/forward browser buttons move between docs — verified
- [x] Direct link to a hash opens that doc on load — verified, including the same-document hash-only case (required an unplanned `hashchange` listener fix)

## Phase 2: Polish
- [x] Task 3: Minimal styling pass (light/dark, readable width, active-nav state)
- [x] Task 4: README pointer + serve instructions

### Checkpoint: Complete
- [x] Site opens cleanly via `python -m http.server` — correction from the original plan: must be run from the **repo root**, not `docs/site/` (the server can't serve files outside its rooted directory, which the page needs)
- [x] All acceptance criteria in `tasks/plan.md` met

## Deviations from the original plan (discovered during implementation/testing)
- Serve command is `python -m http.server` from the **repo root**, then open `docs/site/index.html` — not `cd docs/site && python -m http.server` as originally planned. Fixed in both the in-page notice and the README pointer.
- Added Subresource Integrity hashes to both CDN `<script>` tags (flagged by an automated security review after the first write) — verified real by fetching each script and computing sha384 directly, then confirmed in a real browser that both scripts still execute (no SRI mismatch).
- Fixed two real bugs found only by browser-testing, not by reading the code: relative image paths inside fetched Markdown resolved against the page's URL instead of the source file's directory (broken screenshots in README); same-document hash navigation didn't re-route because only `popstate` was handled, not `hashchange`.
- Curated doc count grew from 8 to 10 (`CODE_TUTORIAL.md`, `CONTRIBUTING.md` — both written after this plan was drafted).

## Outstanding from earlier in this session (not part of this plan, tracked for visibility)
- [x] Git identity now configured — no longer blocked
- [ ] Commit + push to `main`, then delete stale remote branch `origin/backup/pre-sync-20260612-154817` (0 unique commits — safe)
- [x] `CONTRIBUTING.md` created — no longer missing
