# Changelog

All notable changes to this project will be documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
