# Changelog

All notable changes to this project will be documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

### Changed

### Fixed

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
