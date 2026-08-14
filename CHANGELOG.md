# Changelog

All notable changes to this project will be documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.8] - 2026-08-15

### Added

- Added an in-chat Runs drawer for replay, output comparison, and reproducibility exports.

### Changed

- Focused primary navigation on Chat, Compare, and Library, with advanced workspaces grouped under Workspace and Administration.

## [0.6.7] - 2026-08-15

### Added

- Added direct browser routes for every workspace and conversation, including
  Back/Forward navigation and bookmarkable conversation links.
- Added page-level recovery and a safe SPA fallback that preserves API and
  missing-asset 404 responses.

## [0.6.6] - 2026-08-15

### Changed

- Established explicit frontend boundaries for shared surfaces, attachment
  encoding, model metadata, responsive behavior, and persisted UI preferences.
- Reduced `App.tsx` responsibility without changing routes, APIs, or visible
  workspace behavior.

## [0.6.5] - 2026-08-15

### Changed

- Hardened desktop and mobile navigation with semantic Work, Inspect,
  Personalize, and System group labels for assistive technology.
- Improved the optional Context/Evidence inspector with an explicit control
  relationship, Escape-key dismissal, and predictable full-page transitions
  while preserving its saved open state and active tab.

## [0.6.4] - 2026-08-15

### Added

- Added exact context utilization percentages and used/available token totals to
  the shared Chat, Context, and inspector budget rail.
- Added amber high-pressure warnings from 80% utilization and explicit overflow
  warnings with excess-token counts and corrective guidance.

## [0.6.3] - 2026-08-15

### Added

- Added compact previous/next navigation for saved chat messages with a current
  position counter, smooth centered scrolling, and bounded end states.
- Added a subtle active-message marker and automatic reset to the newest saved
  message when a conversation changes.

## [0.6.2] - 2026-08-15

### Added

- Added inline attachment cards that expose uploading, ready, and failed states
  without interrupting the chat workflow.
- Added actionable upload failures with safe server explanations plus Retry and
  Remove controls; successfully uploaded files are selected for the next message.

## [0.6.1] - 2026-08-15

### Added

- Added a searchable, provider-scoped model picker across Chat, Compare, Replay,
  and assistant presets, with vision and reasoning capability filters.
- Added model cards showing identifiers, context length, reasoning levels, vision
  support, selection state, and source-backed pricing where available.

## [0.6.0] - 2026-08-15

### Added

- Added rich Markdown rendering to Chat and Compare, including GFM tables and
  task lists, syntax-highlighted fenced code with copy controls, and KaTeX math.
- Added grouped, expandable navigation and an optional persisted Context and
  Evidence inspector that docks on wide screens and becomes a drawer elsewhere.

### Changed

- Replaced combined model menus with provider-first, filtered model selectors in
  Chat, Compare, Replay, and assistant creation.
- Moved Chat provider and model selection into the composer and added a
  capability-aware reasoning-effort selector. Unsupported models keep their
  provider default; OpenAI GPT-5.6 models expose their supported effort levels.

## [0.5.1] - 2026-08-15

### Fixed

- Restored Windows PowerShell 5.1 launcher compatibility by avoiding the newer
  `.NET`-only `Path.GetRelativePath` API.
- Corrected the Windows launcher invocation in GitHub Actions for filenames
  containing spaces.

## [0.5.0] - 2026-08-15

### Changed

- Refined the React workspace with a clear Geist type hierarchy, balanced
  responsive geometry, and a dark graphite theme with crimson-rose accents.
- Added compact-screen conversation access and bottom navigation while keeping
  chat, composer, and comparison layouts free of horizontal overflow.

### Fixed

- Migrated legacy five-column preset tables in place so existing workspaces no
  longer fail with a missing `builtin` column.
- Prevented keyless Gemini discovery from constructing a partial SDK client and
  explicitly closed configured asynchronous clients.
- Made both launchers reuse successful setup fingerprints and clear port `8506`
  before starting a fresh Studio process.

## [0.4.0] - 2026-08-14

### Added

- Added parallel comparison across two to four distinct models, with independent
  streaming results, per-model status and errors, duplicate prevention, and a
  shared **Cancel all** action.
- Added the dedicated Agnes AI provider with live `agnes-2.5-flash` discovery,
  `AGNES_API_KEY` environment fallback, official documentation links, and
  source-backed pricing metadata.
- Added source-linked per-model token pricing and estimated input cost to the UI.

### Changed

- OpenAI now honors `OPENAI_BASE_URL` alongside `OPENAI_API_KEY`; the tracked
  `.env.example` remains a credential-free template for other machines.
- Refreshed the README, user guides, tutorial, architecture material, and live
  screenshots for Luna and Agnes 2.5 Flash.

### Fixed

- Omitted the unsupported custom temperature parameter for `gpt-5.6-luna`,
  allowing it to use the model's required default temperature.
- Improved the Windows launcher so an existing valid setup launches directly
  while missing or stale dependencies are installed and rebuilt as needed.

## [0.3.0] - 2026-08-12

### Added

- Added concise top-level usage and technical entrypoints for users and
  contributors.
- Added a Settings action that gracefully stops the managed Studio server and
  cancels active model runs before shutdown.

### Changed

- Refreshed contributor, conduct, security, and README navigation guidance for
  the current local FastAPI and React workspace.
- Changed the default local application port from 8000 to 8506 across the
  backend, Windows launcher, frontend development proxy, and documentation.
- Refreshed the checked-in Understand Anything and Graphify architecture
  artifacts for the current codebase.

### Fixed

- Fixed the Windows launcher when `CHAT_STUDIO_LAUNCH_ARGS` is unset and made
  portable uv installer parsing robust on PowerShell.
- Ensured managed shutdown waits for background generation tasks and closes the
  SQLite connection cleanly.

## [0.2.0] - 2026-07-23

### Added

- Added a FastAPI v2 backend with SQLite persistence, session-scoped credentials, streaming runs, cancellation, and OpenAPI-derived TypeScript contracts.
- Added native adapters and live model discovery for Ollama, OpenAI, Anthropic, Gemini, OpenRouter, xAI, and OmniRoute.
- Added OpenRouter localhost PKCE authentication with in-memory key handling.
- Added a React/Vite/shadcn frontend shell with Chat, Compare, Assistants, Providers, Memory, Activity, and Settings workspaces.
- Added CI checks, the `chat-studio` launcher, frontend API proxying, and v2 setup documentation.

### Changed

- Retained the Streamlit application during the frontend parity window.

### Fixed

- Added per-run event retention and partial output handling for streaming requests.

## [2026-06-13]

### Added

- OSS companion documentation initialized (license, contributing, security, conduct, changelog).
