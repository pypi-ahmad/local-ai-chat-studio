# Changelog

All notable changes to this project will be documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
