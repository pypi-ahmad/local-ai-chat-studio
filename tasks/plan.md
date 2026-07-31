# Implementation Plan: Multipage htmx Documentation Site

## Overview

A static, multipage website under `docs/site/` that presents every project `.md`
doc through one htmx-driven shell: a sidebar nav, hash-routed pages (so links and
the browser back button work), and client-side Markdown rendering. No build step,
no server-side code, no new dependency in `pyproject.toml`/`package.json` — the
renderer loads from CDN at runtime, same pattern as `docs/tutorial/`.

## Architecture Decisions

- **Location: `docs/site/`.** Keeps it alongside the existing `docs/tutorial/`
  (interactive handbook walkthrough) and `docs/archive/` (legacy PDF) without
  colliding with either.
- **Source of truth stays in the root `.md` files — no copies.** The site fetches
  `../../README.md` etc. via `hx-get` at view time. One doc, one place to edit;
  the site can never drift out of sync with the docs it displays.
- **htmx for navigation, marked.js for rendering, both from CDN.** No local
  Markdown parser to write or maintain (checked: no `markdown`/`mistune`/etc.
  package is installed anywhere in this repo — writing one from scratch would be
  the only alternative, and it's strictly more code for a worse result on tables/
  fenced code blocks, which several of these docs use heavily).
- **Must be served over HTTP, not opened as `file://`.** Browsers block `fetch()`
  across `file://` origins. The page states this and gives the one-line command
  (`python -m http.server`, run from `docs/site/`); this is a viewing constraint,
  not a reason to add a build step.
- **Curated file list, not every `*.md` in the tree.** Includes the substantive
  project docs (README, USER_GUIDE, ZERO_TO_HERO_STUDY_HANDBOOK, CHANGELOG,
  CODE_OF_CONDUCT, SECURITY, DATASET, frontend/README). Excludes GitHub issue/PR
  templates, `graphify-out/memory/*` (internal tool session notes, not project
  docs), and anything under `node_modules/`/`.venv/` (vendored third-party
  READMEs/LICENSEs — not this project's content).

## Task List

### Phase 1: Shell

- [ ] Task 1: htmx shell + Markdown rendering
- [ ] Task 2: Navigation + hash routing for all curated docs

### Checkpoint: Phase 1
- [ ] Every curated doc renders correctly (tables, fenced code, images, badges)
- [ ] Back/forward browser buttons move between docs
- [ ] Direct link to a hash (e.g. `#user-guide`) opens that doc on load

### Phase 2: Polish

- [ ] Task 3: Minimal styling pass (readable width, code block contrast, active-nav state)
- [ ] Task 4: README pointer + serve instructions

### Checkpoint: Complete
- [ ] Site opens cleanly via `python -m http.server` from `docs/site/`
- [ ] All acceptance criteria below met

## Task Detail

## Task 1: htmx shell + Markdown rendering

**Description:** Build `docs/site/index.html` — a single-page shell with a
`<nav>` sidebar and a `<main id="content">` pane. Loads `htmx.org` and `marked`
from CDN. Clicking a nav link does `hx-get` on the raw `.md` file into a hidden
holder; a `htmx:afterSwap` listener runs `marked.parse()` on the fetched text and
writes the result into `#content`.

**Acceptance criteria:**
- [ ] Clicking any nav link renders that doc's Markdown as formatted HTML (not raw text) in `#content`
- [ ] Tables, fenced code blocks, and inline images/badges in README.md render correctly
- [ ] No console errors on load or navigation

**Verification:**
- [ ] Manual check: `cd docs/site && python -m http.server 8080`, open `http://localhost:8080`, click through every nav entry

**Dependencies:** None

**Files likely touched:**
- `docs/site/index.html`

**Estimated scope:** Small: 1 file

---

## Task 2: Navigation + hash routing for all curated docs

**Description:** Populate the nav with the 8 curated docs. Use `hx-push-url`
(or manual `location.hash` sync) so each doc gets a stable, linkable URL and the
browser back/forward buttons move between docs. On initial page load, read the
hash (if present) and load the matching doc; default to README if none.

**Acceptance criteria:**
- [ ] All 8 curated docs (README, USER_GUIDE, ZERO_TO_HERO_STUDY_HANDBOOK, CHANGELOG, CODE_OF_CONDUCT, SECURITY, DATASET, frontend/README) have a working nav entry
- [ ] Loading `index.html#<doc-slug>` directly opens that doc
- [ ] Browser back/forward moves between previously visited docs

**Verification:**
- [ ] Manual check: navigate through all 8, use back/forward, reload on a non-default hash

**Dependencies:** Task 1

**Files likely touched:**
- `docs/site/index.html`

**Estimated scope:** Small: 1 file

---

## Task 3: Minimal styling pass

**Description:** Add embedded `<style>` for readable line length, code block
background/contrast (readable in both light and dark OS theme via
`prefers-color-scheme`), and an active/current state on the selected nav item.
No CSS framework — this is a few dozen lines of plain CSS.

**Acceptance criteria:**
- [ ] Body text max-width keeps lines readable (~70-80ch)
- [ ] Code blocks are visually distinct from prose in both light and dark mode
- [ ] The currently-open doc is visually marked in the nav

**Verification:**
- [ ] Manual check: toggle OS/browser dark mode, confirm both themes are legible

**Dependencies:** Task 2

**Files likely touched:**
- `docs/site/index.html`

**Estimated scope:** Small: 1 file

---

## Task 4: README pointer + serve instructions

**Description:** Add a short pointer from the main `README.md` (or
`USER_GUIDE.md`, wherever the other doc links already live) to the new site,
including the one-line serve command and the file:// caveat.

**Acceptance criteria:**
- [ ] README's docs/learning-guide section links to `docs/site/index.html` with the serve command noted

**Verification:**
- [ ] Manual check: link resolves, command works as written

**Dependencies:** Task 1

**Files likely touched:**
- `README.md`

**Estimated scope:** XS: 1 file

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CDN unavailable (offline/air-gapped use) | Low — site just won't render | Acceptable for a docs site; not worth vendoring htmx/marked for this |
| `file://` fetch blocked, user opens index.html directly | Medium — looks broken with no explanation | Task 1 includes an on-page notice with the serve command |
| Marked.js doesn't perfectly match GitHub-flavored Markdown extensions (e.g. task-list checkboxes in plan.md itself) | Low | Acceptable for prose docs; none of the curated 8 docs rely on GFM task lists in body text |

## Open Questions

- None — file list, location, and rendering approach are decided above. Flag here if any should change before Task 1 starts.
