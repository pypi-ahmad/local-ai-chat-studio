# Graph Report - .  (2026-08-12)

## Corpus Check
- 90 files · ~67,119 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 862 nodes · 1634 edges · 72 communities (50 shown, 22 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 89 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- API Contracts and Context
- SQLite Workspace Store
- Provider Adapters and Memory
- Legacy Chat Persistence
- Legacy Provider Settings
- Frontend Runtime Dependencies
- Run Lifecycle Management
- Model Catalog and Labels
- Background Chat Jobs
- Frontend Development Tooling
- App TypeScript Compiler
- Retrieval Augmentation Pipeline
- Frontend API Client
- Reusable UI Primitives
- UI Component Configuration
- Chat Workspace Interface
- Ollama Client Integration
- Node TypeScript Compiler
- Workspace Feature Tests
- Personalization Message Assembly
- Legacy Memory Extraction
- File Attachment Parsing
- Chat Interface Screenshot
- Frontend Lint Rules
- App Error Handling
- Application Settings
- Model Compare Screenshot
- API Contract Tests
- TypeScript Project References
- Architecture and User Guidance
- Generated API Schema
- Learning Tutorials
- Legacy Streamlit Handbook
- Platform Hero Artwork
- Vite Brand Artwork
- Continuous Integration Pipeline
- Pull Request Checklist
- Release History
- Community Conduct Policy
- Integration Documentation
- Documentation and Security Planning
- App Component Tests
- Bug Report Template
- Codebase Orientation Docs
- Application Favicon
- Documentation Icons
- React Brand Artwork
- Badge UI Primitive
- Button UI Primitive
- Graph Query Notes
- Feature Request Template
- Backend App Package
- Backend Package Metadata
- Engineering Conventions
- Legacy Regeneration Flow
- Legacy Health Dashboard
- Legacy Live Generation
- Legacy Preset Seeding
- Legacy Generation Start
- Contribution Workflow
- Dataset Guidance
- Frontend HTML Entrypoint
- Python Project Manifest
- Legacy Settings Export
- Legacy Settings Import
- Legacy Vector Directory
- Legacy Database Path
- Legacy Directory Setup
- Legacy Secret Vault

## God Nodes (most connected - your core abstractions)
1. `Store` - 82 edges
2. `create_app()` - 40 edges
3. `_conn()` - 32 edges
4. `ChatMessage` - 25 edges
5. `cn()` - 24 edges
6. `ProviderAdapter` - 22 edges
7. `RunManager` - 22 edges
8. `ModelDescriptor` - 21 edges
9. `compilerOptions` - 21 edges
10. `utc_now()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `app.send_user_message` --calls--> `add_message()`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/chat_store.py
- `Background worker pattern (daemon threads + Job registry)` --references--> `Job`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py
- `Functional module style with typed data carriers` --references--> `Attachment`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/files.py
- `jobs._process_attachments` --calls--> `chunk_text()`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/files.py
- `Functional module style with typed data carriers` --references--> `Job`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Architecture Learning Documentation** — code_tutorial_overview, zero_to_hero_study_handbook, docs_tutorial_index_interactive_handbook [INFERRED 0.85]
- **Runtime Safety Boundary** — docs_codebase_architecture_context_preflight, docs_codebase_concerns_protected_boundaries, docs_codebase_integrations_external_integrations [INFERRED 0.75]
- **Documentation Site Delivery** — tasks_plan_documentation_site_plan, docs_site_index_documentation_shell, tasks_todo_documentation_site_status [EXTRACTED 1.00]
- **Active Chat Session Setup** — docs_screenshot_chat_default_assistant, docs_screenshot_chat_ollama_local_provider, docs_screenshot_chat_deepseek_ocr_latest_model, docs_screenshot_chat_message_composer [EXTRACTED 1.00]
- **Parallel Model Comparison** — docs_screenshot_compare_compare_interface, docs_screenshot_compare_gemma4_31b_cloud, docs_screenshot_compare_qwen3_coder_next_cloud, docs_screenshot_compare_unit_test_prompt, docs_screenshot_compare_gemma_response, docs_screenshot_compare_qwen_response [EXTRACTED 1.00]
- **Vite Brand Mark Composition** — frontend_src_assets_vite_lightning_bolt, frontend_src_assets_vite_parentheses, frontend_src_assets_vite_glowing_gradient [INFERRED 0.95]

## Communities (72 total, 22 thin omitted)

### Community 0 - "API Contracts and Context"
Cohesion: 0.09
Nodes (63): main(), Backpack, BackpackCreate, BackpackItem, BackpackItemInput, ContextPlan, ContextSection, ContextSource (+55 more)

### Community 1 - "SQLite Workspace Store"
Cohesion: 0.06
Nodes (13): utc_now(), Any, Conversation, RunEvent, RunSnapshot, Store, Backpack, FocusSession (+5 more)

### Community 2 - "Provider Adapters and Memory"
Cohesion: 0.08
Nodes (33): ABC, AsyncClient, ChatMessage, ModelDescriptor, ProviderDiscovery, _category(), _complete(), _consolidation_prompt() (+25 more)

### Community 3 - "Legacy Chat Persistence"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 4 - "Legacy Provider Settings"
Cohesion: 0.09
Nodes (36): jobs._stream, ollama_client._client (cached client factory), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host() (+28 more)

### Community 5 - "Frontend Runtime Dependencies"
Cohesion: 0.06
Nodes (34): @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, dependencies, @base-ui/react, class-variance-authority, clsx (+26 more)

### Community 6 - "Run Lifecycle Management"
Cohesion: 0.12
Nodes (11): RunEvent, RunStatus, RunEvent, RunSnapshot, RunManager, RunState, _anthropic_wif_configured(), SessionVault (+3 more)

### Community 7 - "Model Catalog and Labels"
Cohesion: 0.10
Nodes (24): Functional module style with typed data carriers, best_coding_model(), build_model_catalog(), normalize_model_key(), ordered_keys(), present_groups(), Unified model catalog shared by the chat page and the Compare page., Pick the best available model for the built-in Coding Agent preset. (+16 more)

### Community 8 - "Background Chat Jobs"
Cohesion: 0.13
Nodes (24): app.send_user_message, _friendly_error(), get(), is_running(), Job, _process_attachments(), Any, Background generation jobs.  A chat reply runs in a daemon thread instead of b (+16 more)

### Community 9 - "Frontend Development Tooling"
Cohesion: 0.07
Nodes (27): devDependencies, jsdom, openapi-typescript, oxlint, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, @types/node (+19 more)

### Community 10 - "App TypeScript Compiler"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 11 - "Retrieval Augmentation Pipeline"
Cohesion: 0.17
Nodes (25): Use the canonical Chroma index when configured, with a SQLite lexical fallback., retrieve_context(), clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector() (+17 more)

### Community 12 - "Frontend API Client"
Cohesion: 0.08
Nodes (20): api, ApiError, Backpack, ContextPlan, Conversation, FocusSession, Memory, ModelSummary (+12 more)

### Community 13 - "Reusable UI Primitives"
Cohesion: 0.15
Nodes (15): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), Input() (+7 more)

### Community 14 - "UI Component Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 15 - "Chat Workspace Interface"
Cohesion: 0.11
Nodes (8): streamRun(), App(), ComparePage(), defaultPolicy, fileAsBase64(), messageOf(), navigation, Page

### Community 16 - "Ollama Client Integration"
Cohesion: 0.12
Nodes (21): _client(), describe_image(), embed_texts(), embedding_model(), list_models(), ollama_alive(), Any, Ollama integration: dynamic model discovery, capability checks, streaming chat. (+13 more)

### Community 17 - "Node TypeScript Compiler"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 18 - "Workspace Feature Tests"
Cohesion: 0.29
Nodes (18): _complete_echo_run(), _conversation(), TestClient, test_branch_backpack_focus_and_provider_policy(), test_cloud_preflight_warns_about_secrets_and_excludes_private_context(), test_context_budget_prunes_sources_and_private_text_can_be_sanitized(), test_cross_chat_retrieval_has_provenance_and_can_be_excluded(), test_image_attachment_is_available_to_full_replay_but_not_redacted_share() (+10 more)

### Community 19 - "Personalization Message Assembly"
Cohesion: 0.18
Nodes (12): Application configuration via Pydantic Settings (env-overridable)., _maybe_extract(), build_messages(), Any, Assemble the per-turn message list: system prompt + retrieved context + history., Build the Ollama message list for this turn.      Returns (messages, reference, get_profile(), note_conversation_done() (+4 more)

### Community 20 - "Legacy Memory Extraction"
Cohesion: 0.16
Nodes (12): jobs._maybe_extract, _autotitle(), memory._parse_json_list, extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Pinned memories + semantically relevant ones, capped, usage-bumped. (+4 more)

### Community 21 - "File Attachment Parsing"
Cohesion: 0.26
Nodes (11): Attachment, _ext(), _parse_docx(), _parse_excel(), _parse_legacy_doc(), _parse_pdf(), parse_upload(), Parse uploaded files into text, and prepare images for vision models. (+3 more)

### Community 22 - "Chat Interface Screenshot"
Cohesion: 0.25
Nodes (11): Chat Configuration, Chat History Search, Chat Studio Interface, DeepSeek OCR Latest Model, Default Assistant, Document OCR and Vision, Message Composer, Ollama Local Provider (+3 more)

### Community 23 - "Frontend Lint Rules"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 24 - "App Error Handling"
Cohesion: 0.28
Nodes (4): ErrorBoundary, Props, State, react

### Community 25 - "Application Settings"
Cohesion: 0.32
Nodes (4): BaseSettings, Path, AppConfig, Settings for the local AI chat studio.      Every field can be overridden with

### Community 26 - "Model Compare Screenshot"
Cohesion: 0.46
Nodes (8): Model Compare Interface, Ollama Cloud gemma4:31b-cloud, Gemma Unit Test Response, Ollama Cloud qwen3-coder-next:cloud, Qwen Unit Test Response, Response Latency and Throughput, Good Unit Test Prompt, Unit Test Quality Principles

### Community 27 - "API Contract Tests"
Cohesion: 0.43
Nodes (7): TestClient, test_anthropic_reports_workload_identity_source(), test_conversation_crud_preserves_message_order(), test_health_and_session_cookie(), test_openrouter_auth_uses_session_pkce_and_current_callback_origin(), test_provider_secret_is_scoped_to_browser_session(), test_run_stream_contract_retains_completed_output()

### Community 28 - "TypeScript Project References"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, ignoreDeprecations, paths, files, references

### Community 29 - "Architecture and User Guidance"
Cohesion: 0.33
Nodes (6): Context Preflight, System Architecture, Codebase Concerns, Protected Boundaries, Memory Curation, User Workflows

### Community 30 - "Generated API Schema"
Cohesion: 0.33
Nodes (5): components, $defs, operations, paths, webhooks

### Community 31 - "Learning Tutorials"
Cohesion: 0.40
Nodes (5): Context Assembly, Code Tutorial, Interactive Tutorial Handbook, Architecture Learning Path, Zero to Hero Study Handbook

### Community 32 - "Legacy Streamlit Handbook"
Cohesion: 0.40
Nodes (5): Background worker pattern (daemon threads + Job registry), Zero-to-Hero Study Handbook, legacy v1 (PDF, Streamlit-only), Event-driven UI with Streamlit reruns, pyproject.toml - project metadata & dependencies, .streamlit/config.toml - theme/server config

### Community 33 - "Platform Hero Artwork"
Cohesion: 0.40
Nodes (5): Layered Platform Hero, Layered Architecture Metaphor, Lower Platform, Upper Layer, Vertical Connectors

### Community 34 - "Vite Brand Artwork"
Cohesion: 0.40
Nodes (5): Adaptive Parenthesis Contrast, Purple Cyan Glow, Purple Lightning Bolt, Enclosing Parentheses, Vite Logo

### Community 35 - "Continuous Integration Pipeline"
Cohesion: 0.40
Nodes (5): Backend CI Job, CI Pipeline, Frontend CI Job, pytest, Ruff

### Community 36 - "Pull Request Checklist"
Cohesion: 0.50
Nodes (4): End-to-End Verification, Pull Request Review Contract, Secret and Model Hygiene, Worker and UI Separation

### Community 37 - "Release History"
Cohesion: 0.50
Nodes (4): FastAPI v2 Backend, Native Provider Adapters, React Vite Frontend, Release 0.2.0

### Community 38 - "Community Conduct Policy"
Cohesion: 0.50
Nodes (4): Code of Conduct, Contributor Covenant 2.1, Maintainer Enforcement, Welcoming Contribution Standard

### Community 39 - "Integration Documentation"
Cohesion: 0.50
Nodes (4): External Integrations, OpenCode Loopback Bridge, Project Overview, Provider Support

### Community 40 - "Documentation and Security Planning"
Cohesion: 0.50
Nodes (4): Documentation Site Shell, Security Policy, Documentation Site Implementation Plan, Documentation Site Task Status

### Community 42 - "Bug Report Template"
Cohesion: 0.67
Nodes (3): Bug Report Template, Reproduction Environment, Bug Reproduction Steps

### Community 43 - "Codebase Orientation Docs"
Cohesion: 0.67
Nodes (3): Technology Stack, Codebase Structure, Frontend Workspace

### Community 44 - "Application Favicon"
Cohesion: 0.67
Nodes (3): Application Favicon, Lightning Bolt, Neon Gradient

### Community 45 - "Documentation Icons"
Cohesion: 0.67
Nodes (3): Documentation, Documentation Icon, Source Code

### Community 46 - "React Brand Artwork"
Cohesion: 0.67
Nodes (3): Atomic Orbit Motif, React, React Logo

### Community 49 - "Graph Query Notes"
Cohesion: 0.67
Nodes (3): ModelInfo Boundary Contract, ModelInfo Lifecycle, Selected Model Runtime Handoff

## Knowledge Gaps
- **176 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+171 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Store` connect `SQLite Workspace Store` to `API Contracts and Context`, `Workspace Feature Tests`, `Retrieval Augmentation Pipeline`, `Run Lifecycle Management`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `create_app()` connect `API Contracts and Context` to `SQLite Workspace Store`, `Provider Adapters and Memory`, `Run Lifecycle Management`, `Retrieval Augmentation Pipeline`, `Workspace Feature Tests`, `File Attachment Parsing`, `Application Settings`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `parse_upload()` connect `File Attachment Parsing` to `API Contracts and Context`, `Background Chat Jobs`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `Store` (e.g. with `RunManager` and `RunState`) actually correct?**
  _`Store` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `create_app()` (e.g. with `Backpack` and `ContextPlan`) actually correct?**
  _`create_app()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `ChatMessage` (e.g. with `ExtractionOutcome` and `AnthropicAdapter`) actually correct?**
  _`ChatMessage` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _176 weakly-connected nodes found - possible documentation gaps or missing edges._