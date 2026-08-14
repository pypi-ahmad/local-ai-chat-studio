# Changelog

All notable changes to this project will be documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.7.13] - 2026-08-15

### Changed

- Expanded the README with explicit frontend layer ownership, persisted-versus-local
  state boundaries, and page-level recovery behavior.
- Updated contributor and technical references for the route, feature, hook, state,
  and generated API boundaries introduced in v0.7.12.
- Corrected the study handbook and tutorials to follow the current Chat preflight,
  conversation-turn, streaming, persistence, and route-composition flow.

## [0.7.12] - 2026-08-15

### Changed

- Split the React workspace into page-level route components and focused composer,
  message-list, model-picker, context-inspector, and conversation-history features.
- Reduced `App.tsx` to session/API orchestration and route composition while keeping
  generated backend contracts authoritative and isolating browser-persisted shell
  preferences in a dedicated hook.
- Kept the existing browser URLs behind the page-level error boundary with no API or
  user-visible workflow changes.

## [0.7.11] - 2026-08-15

### Added

- Added durable conversation folders, pinned and date-based history groups, folder-aware
  search, and an adjustable desktop conversation sidebar whose width is remembered.
- Added a searchable `Ctrl/Cmd+K` command palette for workspace navigation, new chats,
  the Context/Evidence inspector, and run actions.
- Added loading skeletons, actionable empty states, starter prompts, and collapsible
  tool-result activity inside the transcript.

### Changed

- Refined the responsive near-black workspace with quieter borders, a restrained
  red-pink context spine, and clearer grouping for ordinary chat versus advanced tools.

## [0.7.10] - 2026-08-15

### Added

- Added a guarded Work Mode for local stdio and remote Streamable HTTP MCP servers,
  explicit tool discovery, JSON-Schema argument validation, and user- or
  agent-originated proposals.
- Added a session-owned approval inbox with exact redacted arguments, rationale,
  immutable execution hashes, approve/deny reasons, and a durable terminal audit log.

### Security

- MCP registration is inert, approvals are single-use, raw arguments are scrubbed
  after terminal decisions, and results are bounded and redacted.
- Local servers run without a shell, with an executable allowlist, minimal environment,
  isolated working directory, and timeout. Remote endpoints require public HTTPS and
  reject embedded credentials and private/reserved DNS targets. These controls are
  explicitly documented as process isolation rather than an OS sandbox.

## [0.7.9] - 2026-08-15

### Added

- Added searchable Knowledge Bases in Library, with create, edit, delete, source-ledger,
  availability, and one-click bind/unbind controls.
- Added reusable mixed-source bases over current-chat files, active memories,
  backpacks, and optional related-conversation retrieval.
- Added a persisted per-conversation knowledge-base binding and a dedicated preflight
  `knowledge` section with source provenance.

### Changed

- Deleting a knowledge base now safely clears every matching conversation binding;
  deleting an underlying file, memory, or backpack removes its source reference while
  preserving the rest of the base.

### Security

- Bound sources reuse the existing provider-policy, prompt-injection scanning,
  source-exclusion, token-budget, and pruning boundaries before model execution.

## [0.7.8] - 2026-08-15

### Added

- Added a responsive Chat split pane for previewing fenced HTML, SVG, Mermaid, and
  code output, with source inspection, copy, and close controls.

### Security

- Isolated rendered artifacts in unique-origin, scriptless iframes with a restrictive
  content-security policy and no-referrer policy; code output remains escaped text.

## [0.7.7] - 2026-08-15

### Added

- Added conversation-level Markdown, standalone HTML, plain-text, and structured-JSON
  downloads from the Chat header.
- Added one-click export of the active conversation's latest completed run as a full
  reproducibility bundle.

### Security

- Standalone HTML exports escape all persisted conversation content and include a
  restrictive document content-security policy.

## [0.7.6] - 2026-08-15

### Added

- Added a searchable Assistant gallery with role icons, prompt descriptions,
  model and temperature metadata, browser-local favorites, and recent assistants.
- Added one-click assistant chat creation that atomically applies the preset's
  model, temperature, and system prompt to a new conversation.

### Changed

- Reorganized Library around the Assistant gallery while retaining memory,
  assistant creation, and conversation-file tools below it.

## [0.7.5] - 2026-08-15

### Added

- Added durable per-conversation settings for model, reasoning effort, temperature,
  context policy, web evidence, history compression, system prompt, and message layout.
- Added Conversation, Compact, and Full-width message layouts plus a conversation-
  specific system-prompt editor in Chat.

### Changed

- Conversation branches now inherit the source conversation's settings and can then
  be customized independently.
- Custom conversation system prompts now participate in context estimates, approved
  plan hashes, provider requests, and replay bundles.
- Existing SQLite databases automatically gain the new settings storage without
  deleting or recreating user data.

## [0.7.4] - 2026-08-15

### Added

- Added opt-in local compression that summarizes older conversation messages while
  preserving the latest eight messages verbatim.
- Added compression status and compressed-message counts to the context budget rail.

### Changed

- Over-budget context plans now stop before provider execution and retain the draft
  so users can reduce context or choose a larger-window model.
- Context planning and final message assembly now use the same approved history
  sources, including pruning and trust exclusions.

## [0.7.3] - 2026-08-15

### Added

- Added jump-to-top and jump-to-bottom actions to the compact transcript navigator.
- Added scroll-aware unread-output signaling when a response streams while the
  reader is reviewing an earlier message.

### Changed

- Adapted the message navigator into a vertical desktop rail and horizontal mobile
  control while preserving previous/next navigation and the exact position counter.

## [0.7.2] - 2026-08-15

### Added

- Added attachment cards that show upload and parsing/indexing progress, file type,
  exact size, ready state, and server errors directly above the composer.
- Added durable removal for stored conversation uploads; failed uploads retain
  explicit Retry and Remove actions.

## [0.7.1] - 2026-08-15

### Added

- Added a unified composer control dock for attachments, provider/model selection,
  reasoning effort, context scope, and send/stop actions.
- Added compact secondary settings for temperature presets and opt-in web evidence.

### Changed

- Context scope now maps directly to preflight source flags, so each turn can use
  full local context, chat only, or selected files plus chat.

## [0.7.0] - 2026-08-15

### Added

- Expanded the provider-scoped model picker with provider marks, tool-use filtering, model favorites, and the six most recent choices.

### Changed

- Grouped model results into favorites, recent choices, and the remaining catalog while retaining context, capability, and pricing details.

## [0.6.9] - 2026-08-15

### Added

- Added lazy Mermaid rendering for fenced diagrams in Chat and Compare, with a red-pink dark theme and readable invalid-syntax fallback.

### Security

- Mermaid runs with strict security, disabled click actions, protected site configuration, and no automatic page scanning.

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
