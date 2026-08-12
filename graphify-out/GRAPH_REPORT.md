# Graph Report - D:/AI/Github/local-ai-chat-studio  (2026-08-12)

## Corpus Check
- 90 files · ~57,855 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 824 nodes · 1472 edges · 72 communities (44 shown, 28 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend API Runtime
- Workspace Data Store
- Typed Workspace API
- React Studio Shell
- Conversation Data Store
- Cloud Provider Integration
- Model Metadata Labels
- Frontend Runtime Dependencies
- Provider Adapters
- TypeScript App Compiler
- Vector Retrieval Memory
- Frontend Development Tooling
- UI Component Configuration
- Background Chat Jobs
- TypeScript Tooling Compiler
- Prompt Context Orchestration
- Workspace Feature Tests
- Document Attachment Processing
- Ollama Runtime Client
- Memory Extraction Workflow
- Chat Interface Screenshot
- Architecture Study Guide
- Storage Path Configuration
- Model Comparison Screenshot
- TypeScript Project References
- API Contract Tests
- Project Documentation
- Platform Hero Artwork
- Vite Brand Asset
- Continuous Integration Pipeline
- Pull Request Quality Gates
- Release Changelog
- Contributor Conduct
- Context and Run Flow
- Documentation Site Delivery
- Interactive Tutorial Runtime
- Bug Report Workflow
- Runtime Security Boundaries
- Contract Testing Workflow
- App Favicon Design
- Documentation Source Icons
- React Brand Asset
- Feature Request Workflow
- FastAPI App Package
- Backend Package Metadata
- Privacy and Safety
- Codebase Reference
- Legacy Migration Notes
- Dataset Documentation
- Current System Architecture
- Codebase Concerns
- Coding Conventions
- Canonical Data Migration
- External Integrations
- Testing Patterns
- Interactive Tutorial
- Frontend HTML Entry
- Generated OpenAPI Schema
- React Workspace
- Python Package Metadata
- Run Snapshots
- Settings Export Documentation
- Settings Import Documentation
- Vector Store Path
- SQLite Database Path
- Storage Directory Setup
- Session Credential Vault
- Evidence Preflight
- Legacy Parity Migration

## God Nodes (most connected - your core abstractions)
1. `Store` - 80 edges
2. `create_app()` - 33 edges
3. `_conn()` - 32 edges
4. `cn()` - 24 edges
5. `RunManager` - 22 edges
6. `compilerOptions` - 21 edges
7. `_run()` - 19 edges
8. `ModelInfo` - 19 edges
9. `utc_now()` - 19 edges
10. `ChatMessage` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Functional module style with typed data carriers` --references--> `SelectedModel`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/catalog.py
- `Background worker pattern (daemon threads + Job registry)` --references--> `Job`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py
- `_run()` --calls--> `jobs._process_attachments`  [EXTRACTED]
  src/jobs.py → docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf
- `_run()` --calls--> `jobs._stream`  [EXTRACTED]
  src/jobs.py → docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf
- `jobs._maybe_extract` --calls--> `extract_memories()`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/memory.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Documentation Site Delivery** — tasks_plan_documentation_site_plan, docs_site_index_documentation_shell, tasks_todo_documentation_site_status [EXTRACTED 1.00]
- **Active Chat Session Setup** — docs_screenshot_chat_default_assistant, docs_screenshot_chat_ollama_local_provider, docs_screenshot_chat_deepseek_ocr_latest_model, docs_screenshot_chat_message_composer [EXTRACTED 1.00]
- **Parallel Model Comparison** — docs_screenshot_compare_compare_interface, docs_screenshot_compare_gemma4_31b_cloud, docs_screenshot_compare_qwen3_coder_next_cloud, docs_screenshot_compare_unit_test_prompt, docs_screenshot_compare_gemma_response, docs_screenshot_compare_qwen_response [EXTRACTED 1.00]
- **Vite Brand Mark Composition** — frontend_src_assets_vite_lightning_bolt, frontend_src_assets_vite_parentheses, frontend_src_assets_vite_glowing_gradient [INFERRED 0.95]

## Communities (72 total, 28 thin omitted)

### Community 0 - "Backend API Runtime"
Cohesion: 0.06
Nodes (70): main(), Backpack, BackpackCreate, BackpackItem, BackpackItemInput, ContextPlan, ContextSection, ContextSource (+62 more)

### Community 1 - "Workspace Data Store"
Cohesion: 0.06
Nodes (14): Any, utc_now(), RunEvent, RunSnapshot, Store, Backpack, Conversation, FocusSession (+6 more)

### Community 2 - "Typed Workspace API"
Cohesion: 0.05
Nodes (32): api, ApiError, Backpack, ContextPlan, Conversation, FocusSession, Memory, ModelSummary (+24 more)

### Community 3 - "React Studio Shell"
Cohesion: 0.07
Nodes (30): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, Badge(), badgeVariants, Button() (+22 more)

### Community 4 - "Conversation Data Store"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 5 - "Cloud Provider Integration"
Cohesion: 0.09
Nodes (35): ollama_client._client (cached client factory), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host(), get_ollama_key() (+27 more)

### Community 6 - "Model Metadata Labels"
Cohesion: 0.08
Nodes (29): best_coding_model(), build_model_catalog(), normalize_model_key(), ordered_keys(), present_groups(), Unified model catalog shared by the chat page and the Compare page., Pick the best available model for the built-in Coding Agent preset., Uniform view over an Ollama model or a cloud-provider model. (+21 more)

### Community 7 - "Frontend Runtime Dependencies"
Cohesion: 0.06
Nodes (34): @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, dependencies, @base-ui/react, class-variance-authority, clsx (+26 more)

### Community 8 - "Provider Adapters"
Cohesion: 0.17
Nodes (14): ABC, ChatMessage, ModelDescriptor, ProviderDiscovery, AnthropicAdapter, build_provider_registry(), GeminiAdapter, OllamaAdapter (+6 more)

### Community 9 - "TypeScript App Compiler"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 10 - "Vector Retrieval Memory"
Cohesion: 0.17
Nodes (25): embed_texts(), Embed a batch of texts with the auto-detected Ollama embedding model., clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector() (+17 more)

### Community 11 - "Frontend Development Tooling"
Cohesion: 0.09
Nodes (25): devDependencies, jsdom, openapi-typescript, oxlint, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, @types/node (+17 more)

### Community 12 - "UI Component Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "Background Chat Jobs"
Cohesion: 0.16
Nodes (19): _friendly_error(), get(), is_running(), Any, Background generation jobs.  A chat reply runs in a daemon thread instead of b, Spawn a background worker for one assistant reply and return its Job.      Tak, Fire-and-forget generation NOT tied to a conversation (model compare).      St, DuckDuckGo search (no API key). Returns [{title, url, snippet}]; never raises. (+11 more)

### Community 14 - "TypeScript Tooling Compiler"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 15 - "Prompt Context Orchestration"
Cohesion: 0.15
Nodes (14): Application configuration via Pydantic Settings (env-overridable)., _maybe_extract(), Pinned memories + semantically relevant ones, capped, usage-bumped., relevant_memories(), build_messages(), Any, Assemble the per-turn message list: system prompt + retrieved context + history., Build the Ollama message list for this turn.      Returns (messages, reference (+6 more)

### Community 16 - "Workspace Feature Tests"
Cohesion: 0.34
Nodes (16): TestClient, _complete_echo_run(), _conversation(), test_branch_backpack_focus_and_provider_policy(), test_cloud_preflight_warns_about_secrets_and_excludes_private_context(), test_context_budget_prunes_sources_and_private_text_can_be_sanitized(), test_cross_chat_retrieval_has_provenance_and_can_be_excluded(), test_image_attachment_is_available_to_full_replay_but_not_redacted_share() (+8 more)

### Community 17 - "Document Attachment Processing"
Cohesion: 0.20
Nodes (14): chunk_text(), _ext(), _parse_docx(), _parse_excel(), _parse_legacy_doc(), _parse_pdf(), parse_upload(), Parse uploaded files into text, and prepare images for vision models. (+6 more)

### Community 18 - "Ollama Runtime Client"
Cohesion: 0.19
Nodes (14): jobs._stream, _client(), describe_image(), list_models(), ollama_alive(), Any, Ollama integration: dynamic model discovery, capability checks, streaming chat., Stream a chat completion, yielding content deltas.      If ``stats`` is given, (+6 more)

### Community 19 - "Memory Extraction Workflow"
Cohesion: 0.20
Nodes (10): jobs._maybe_extract, _autotitle(), memory._parse_json_list, extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Tolerant JSON-list parser for small-model output (strips fences/prose). (+2 more)

### Community 20 - "Chat Interface Screenshot"
Cohesion: 0.25
Nodes (11): Chat Configuration, Chat History Search, Chat Studio Interface, DeepSeek OCR Latest Model, Default Assistant, Document OCR and Vision, Message Composer, Ollama Local Provider (+3 more)

### Community 21 - "Architecture Study Guide"
Cohesion: 0.24
Nodes (9): Background worker pattern (daemon threads + Job registry), Zero-to-Hero Study Handbook, legacy v1 (PDF, Streamlit-only), Event-driven UI with Streamlit reruns, Functional module style with typed data carriers, pyproject.toml - project metadata & dependencies, Attachment, Job, In-flight (or just-finished) generation for one conversation. (+1 more)

### Community 22 - "Storage Path Configuration"
Cohesion: 0.32
Nodes (4): BaseSettings, Path, AppConfig, Settings for the local AI chat studio.      Every field can be overridden with

### Community 23 - "Model Comparison Screenshot"
Cohesion: 0.46
Nodes (8): Model Compare Interface, Ollama Cloud gemma4:31b-cloud, Gemma Unit Test Response, Ollama Cloud qwen3-coder-next:cloud, Qwen Unit Test Response, Response Latency and Throughput, Good Unit Test Prompt, Unit Test Quality Principles

### Community 24 - "TypeScript Project References"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, ignoreDeprecations, paths, files, references

### Community 25 - "API Contract Tests"
Cohesion: 0.48
Nodes (6): TestClient, test_conversation_crud_preserves_message_order(), test_health_and_session_cookie(), test_openrouter_auth_uses_session_pkce_and_current_callback_origin(), test_provider_secret_is_scoped_to_browser_session(), test_run_stream_contract_retains_completed_output()

### Community 26 - "Project Documentation"
Cohesion: 0.50
Nodes (5): Codebase Walkthrough, Contribution Workflow, Local AI Chat Studio Overview, Studio Workflows, Zero-to-Hero Study Handbook

### Community 27 - "Platform Hero Artwork"
Cohesion: 0.40
Nodes (5): Layered Platform Hero, Layered Architecture Metaphor, Lower Platform, Upper Layer, Vertical Connectors

### Community 28 - "Vite Brand Asset"
Cohesion: 0.40
Nodes (5): Adaptive Parenthesis Contrast, Purple Cyan Glow, Purple Lightning Bolt, Enclosing Parentheses, Vite Logo

### Community 29 - "Continuous Integration Pipeline"
Cohesion: 0.40
Nodes (5): Backend CI Job, CI Pipeline, Frontend CI Job, pytest, Ruff

### Community 30 - "Pull Request Quality Gates"
Cohesion: 0.50
Nodes (4): End-to-End Verification, Pull Request Review Contract, Secret and Model Hygiene, Worker and UI Separation

### Community 31 - "Release Changelog"
Cohesion: 0.50
Nodes (4): FastAPI v2 Backend, Native Provider Adapters, React Vite Frontend, Release 0.2.0

### Community 32 - "Contributor Conduct"
Cohesion: 0.50
Nodes (4): Code of Conduct, Contributor Covenant 2.1, Maintainer Enforcement, Welcoming Contribution Standard

### Community 33 - "Context and Run Flow"
Cohesion: 0.50
Nodes (4): Hash-Bound Context Preflight, Persisted SSE Runs, Provider Context Policy, Connected Frontend Workspace Tests

### Community 34 - "Documentation Site Delivery"
Cohesion: 0.50
Nodes (4): Documentation Site Shell, Security Policy, Documentation Site Implementation Plan, Documentation Site Task Status

### Community 36 - "Bug Report Workflow"
Cohesion: 0.67
Nodes (3): Bug Report Template, Reproduction Environment, Bug Reproduction Steps

### Community 37 - "Runtime Security Boundaries"
Cohesion: 0.67
Nodes (3): Single-Process Localhost Boundary, Credential Nonpersistence, Session Credential Vault

### Community 38 - "Contract Testing Workflow"
Cohesion: 0.67
Nodes (3): Contract Schema Regeneration, Isolated Backend Testing Convention, Backend Contract Coverage

### Community 39 - "App Favicon Design"
Cohesion: 0.67
Nodes (3): Application Favicon, Lightning Bolt, Neon Gradient

### Community 40 - "Documentation Source Icons"
Cohesion: 0.67
Nodes (3): Documentation, Documentation Icon, Source Code

### Community 41 - "React Brand Asset"
Cohesion: 0.67
Nodes (3): Atomic Orbit Motif, React, React Logo

## Knowledge Gaps
- **169 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+164 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Store` connect `Workspace Data Store` to `Backend API Runtime`, `Workspace Feature Tests`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `RunManager` connect `Backend API Runtime` to `Provider Adapters`, `Workspace Data Store`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `ModelInfo` connect `Model Metadata Labels` to `Ollama Runtime Client`, `Architecture Study Guide`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `Store` (e.g. with `RunManager` and `RunState`) actually correct?**
  _`Store` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `create_app()` (e.g. with `Backpack` and `ContextPlan`) actually correct?**
  _`create_app()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _169 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend API Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.05792620078334364 - nodes in this community are weakly interconnected._