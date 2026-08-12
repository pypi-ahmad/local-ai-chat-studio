# Graph Report - .  (2026-08-12)

## Corpus Check
- 157 files · ~207,226 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 924 nodes · 1571 edges · 74 communities (57 shown, 17 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend API Runtime
- Conversation Data Store
- Architecture Study Guide
- Cloud Provider Integration
- Responsive Sidebar UI
- Frontend Runtime Dependencies
- Shared UI Primitives
- React Studio Shell
- User Product Guide
- Frontend Development Tooling
- TypeScript App Compiler
- Vector Retrieval Memory
- Background Chat Jobs
- Dialog and Sheet UI
- UI Component Configuration
- TypeScript Tooling Compiler
- Streamlit App Orchestration
- Model Metadata Labels
- Model Catalog Selection
- Dropdown Menu Components
- Form Field Components
- Prompt Context Orchestration
- Document Attachment Processing
- Generated Batch Builder
- Memory Extraction Workflow
- Generated Frontend Batch
- Chat Interface Screenshot
- Typed API Client
- Ollama Runtime Client
- User Personalization Memory
- Model Comparison Page
- Chat Generation Actions
- Storage Path Configuration
- Frontend Lint Configuration
- React Error Boundary
- Generated Graph Assembler
- Model Comparison Screenshot
- Documentation Site Delivery
- TypeScript Project References
- API Contract Tests
- Generated Graph Save
- Generated Graph Metadata
- Platform Hero Artwork
- Vite Brand Asset
- Continuous Integration Pipeline
- Pull Request Quality Gates
- Release Changelog
- Contributor Conduct
- Interactive Tutorial Runtime
- Generated Architecture Analysis
- Generated Tour Analysis
- Bug Report Workflow
- App Favicon Design
- Documentation Source Icons
- Frontend Starter Guide
- React Brand Asset
- Saved Graph Query Memory
- Feature Request Workflow
- FastAPI App Package
- Backend Package Metadata
- Provider Settings Page
- Generated Graph Validation
- Retrieval Augmented Generation
- Dataset Documentation
- Frontend HTML Entry
- Python Package Metadata
- Settings Export Documentation
- Settings Import Documentation
- Vector Store Path
- SQLite Database Path
- Storage Directory Setup

## God Nodes (most connected - your core abstractions)
1. `cn()` - 120 edges
2. `ZERO_TO_HERO_STUDY_HANDBOOK.md` - 34 edges
3. `_conn()` - 32 edges
4. `USER_GUIDE.md (Local AI Chat Studio — User Guide)` - 23 edges
5. `RunManager` - 21 edges
6. `compilerOptions` - 21 edges
7. `ModelInfo` - 21 edges
8. `create_app()` - 18 edges
9. `react` - 17 edges
10. `ChatMessage` - 16 edges

## Surprising Connections (you probably didn't know these)
- `providers._secrets (in-memory key vault)` --semantically_similar_to--> `SessionVault`  [INFERRED] [semantically similar]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → backend/app/sessions.py
- `Event-driven UI with Streamlit reruns` --semantically_similar_to--> `SPA (single-page application)`  [INFERRED] [semantically similar]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `create_app()` --rationale_for--> `tests/test_api_contract.py - v2 API contract tests`  [EXTRACTED]
  backend/app/main.py → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `OpenAICompatibleAdapter` --rationale_for--> `backend/app/providers.py - normalized provider adapters`  [EXTRACTED]
  backend/app/providers.py → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `Background worker pattern (daemon threads + Job registry)` --references--> `Job`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Add-a-v2-provider contribution flow** — backend_app_sessions_module, backend_app_providers_module, backend_app_main_module, tests_test_api_contract_module [EXTRACTED 1.00]
- **v2 streaming run lifecycle (queued to running to terminal, SSE)** — backend_app_runs_module, backend_app_main_module, backend_app_contracts_module, backend_app_providers_module [EXTRACTED 1.00]
- **Documentation Site Delivery** — tasks_plan_documentation_site_plan, docs_site_index_documentation_shell, tasks_todo_documentation_site_status [EXTRACTED 1.00]
- **Active Chat Session Setup** — docs_screenshot_chat_default_assistant, docs_screenshot_chat_ollama_local_provider, docs_screenshot_chat_deepseek_ocr_latest_model, docs_screenshot_chat_message_composer [EXTRACTED 1.00]
- **Parallel Model Comparison** — docs_screenshot_compare_compare_interface, docs_screenshot_compare_gemma4_31b_cloud, docs_screenshot_compare_qwen3_coder_next_cloud, docs_screenshot_compare_unit_test_prompt, docs_screenshot_compare_gemma_response, docs_screenshot_compare_qwen_response [EXTRACTED 1.00]
- **Vite Brand Mark Composition** — frontend_src_assets_vite_lightning_bolt, frontend_src_assets_vite_parentheses, frontend_src_assets_vite_glowing_gradient [INFERRED 0.95]

## Communities (74 total, 17 thin omitted)

### Community 0 - "Backend API Runtime"
Cohesion: 0.06
Nodes (42): ABC, main(), ChatMessage, Conversation, ConversationCreate, CredentialInput, Message, MessageCreate (+34 more)

### Community 1 - "Conversation Data Store"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 2 - "Architecture Study Guide"
Cohesion: 0.07
Nodes (41): backend/app/cli.py - chat-studio console entrypoint, backend/app/contracts.py - Pydantic API/event contracts, backend/app/main.py - composition root & HTTP routes, SSE run event framing (run.started/run.delta/terminal), backend/app/providers.py - normalized provider adapters, Cooperative run cancellation, backend/app/runs.py - run lifecycle, events, cancellation, backend/app/store.py - SQLite conversations/messages/runs schema (+33 more)

### Community 3 - "Cloud Provider Integration"
Cohesion: 0.09
Nodes (36): cached_provider_models(), ollama_client._client (cached client factory), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host() (+28 more)

### Community 4 - "Responsive Sidebar UI"
Cohesion: 0.07
Nodes (35): react, Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction() (+27 more)

### Community 5 - "Frontend Runtime Dependencies"
Cohesion: 0.06
Nodes (32): @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, dependencies, @base-ui/react, class-variance-authority, clsx (+24 more)

### Community 6 - "Shared UI Primitives"
Cohesion: 0.11
Nodes (29): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), SelectContent(), SelectGroup() (+21 more)

### Community 7 - "React Studio Shell"
Cohesion: 0.09
Nodes (17): navigation, Page, providers, Badge(), badgeVariants, Card(), CardAction(), CardContent() (+9 more)

### Community 8 - "User Product Guide"
Cohesion: 0.08
Nodes (29): CONTRIBUTING.md, Assistants (presets), Auto-discovered models, Why this app exists (the business case), Connect a cloud provider (BYOK), Chat, Coding Agent (built-in assistant), Configuration reference (+21 more)

### Community 9 - "Frontend Development Tooling"
Cohesion: 0.07
Nodes (27): devDependencies, jsdom, openapi-typescript, oxlint, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, @types/node (+19 more)

### Community 10 - "TypeScript App Compiler"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 11 - "Vector Retrieval Memory"
Cohesion: 0.17
Nodes (25): embed_texts(), Embed a batch of texts with the auto-detected Ollama embedding model., clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector() (+17 more)

### Community 12 - "Background Chat Jobs"
Cohesion: 0.15
Nodes (21): Functional module style with typed data carriers, Attachment, _friendly_error(), get(), is_running(), Job, Any, Background generation jobs.  A chat reply runs in a daemon thread instead of b (+13 more)

### Community 13 - "Dialog and Sheet UI"
Cohesion: 0.09
Nodes (15): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle() (+7 more)

### Community 14 - "UI Component Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 15 - "TypeScript Tooling Compiler"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 16 - "Streamlit App Orchestration"
Cohesion: 0.14
Nodes (15): apply_preset(), _maybe_extract_memories(), _on_preset_change(), Local AI Chat Studio — ChatGPT-style UI over Ollama + BYOK cloud providers., Change active conversation, extracting memories from the one we leave., Apply an assistant preset (system prompt + model + temperature)., Auto-refreshing view of an in-flight reply (only this block reruns)., Tiny endpoint health row: latency + which models are loaded. (+7 more)

### Community 17 - "Model Metadata Labels"
Cohesion: 0.15
Nodes (12): dropdown_label(), hint_for(), Generate short use-hints for models from Ollama API metadata.  Purely rule-bas, A 2-3 word use hint, e.g. 'vision, reasoning' or 'coding, fast'., Full dropdown line: name — hint (size)., _size_tag(), embedding_model(), ModelInfo (+4 more)

### Community 18 - "Model Catalog Selection"
Cohesion: 0.17
Nodes (14): seed_builtin_presets(), best_coding_model(), build_model_catalog(), ordered_keys(), present_groups(), Unified model catalog shared by the chat page and the Compare page., Pick the best available model for the built-in Coding Agent preset., Uniform view over an Ollama model or a cloud-provider model. (+6 more)

### Community 19 - "Dropdown Menu Components"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 20 - "Form Field Components"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 21 - "Prompt Context Orchestration"
Cohesion: 0.14
Nodes (12): Settings: generation, features, data export., Application configuration via Pydantic Settings (env-overridable)., jobs._run, jobs._stream, Pinned memories + semantically relevant ones, capped, usage-bumped., relevant_memories(), after_turn_indexing(), build_messages() (+4 more)

### Community 22 - "Document Attachment Processing"
Cohesion: 0.20
Nodes (14): chunk_text(), _ext(), _parse_docx(), _parse_excel(), _parse_legacy_doc(), _parse_pdf(), parse_upload(), Parse uploaded files into text, and prepare images for vision models. (+6 more)

### Community 23 - "Generated Batch Builder"
Cohesion: 0.14
Nodes (11): edges, extracted, fs, functionByPathAndName, groupSize, input, names, nodes (+3 more)

### Community 24 - "Memory Extraction Workflow"
Cohesion: 0.20
Nodes (10): jobs._maybe_extract, _autotitle(), memory._parse_json_list, extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Tolerant JSON-list parser for small-model output (strips fences/prose). (+2 more)

### Community 25 - "Generated Frontend Batch"
Cohesion: 0.17
Nodes (8): batch, edges, files, fs, nodes, parts, result, size

### Community 26 - "Chat Interface Screenshot"
Cohesion: 0.25
Nodes (11): Chat Configuration, Chat History Search, Chat Studio Interface, DeepSeek OCR Latest Model, Default Assistant, Document OCR and Vision, Message Composer, Ollama Local Provider (+3 more)

### Community 27 - "Typed API Client"
Cohesion: 0.20
Nodes (8): api, RunCreate, RunSnapshot, components, $defs, operations, paths, webhooks

### Community 28 - "Ollama Runtime Client"
Cohesion: 0.25
Nodes (10): _client(), describe_image(), Any, Ollama integration: dynamic model discovery, capability checks, streaming chat., Stream a chat completion, yielding content deltas.      If ``stats`` is given,, Models currently loaded in (V)RAM, for the health bar. Never raises., Build (and cache) an Ollama client from the runtime-configured host/key., Use a vision/OCR model to extract a faithful description + text of an image. (+2 more)

### Community 29 - "User Personalization Memory"
Cohesion: 0.31
Nodes (8): Memory manager: view, edit, pin, delete what the assistant knows about you., _maybe_extract(), get_profile(), note_conversation_done(), Rolling user profile: learns style and preferences from chats + feedback., Bump the counter; return True when a profile refresh is due., Regenerate the user profile from recent chats and feedback., rebuild_profile()

### Community 30 - "Model Comparison Page"
Cohesion: 0.28
Nodes (7): cached_models(), _label(), _models(), Side-by-side model compare: one prompt, two models, parallel streams., render_compare(), list_models(), Fetch all models Ollama knows about, with capabilities.      ``/api/tags`` car

### Community 31 - "Chat Generation Actions"
Cohesion: 0.22
Nodes (9): get_state(), Queue a background generation with the current settings., Persist the user's message immediately and queue generation., Delete the last assistant reply and regenerate it with the current model., regenerate_last(), send_user_message(), start_generation(), Best local model for describing/reading images on behalf of text-only models. (+1 more)

### Community 32 - "Storage Path Configuration"
Cohesion: 0.28
Nodes (4): BaseSettings, Path, AppConfig, Settings for the local AI chat studio.      Every field can be overridden with

### Community 33 - "Frontend Lint Configuration"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 34 - "React Error Boundary"
Cohesion: 0.28
Nodes (4): ErrorBoundary, Props, State, react

### Community 35 - "Generated Graph Assembler"
Cohesion: 0.22
Nodes (8): fs, graph, [graphPath, layersPath, tourPath, scanPath, outputPath, gitCommitHash], layers, nodeIds, output, scan, tour

### Community 36 - "Model Comparison Screenshot"
Cohesion: 0.46
Nodes (8): Model Compare Interface, Ollama Cloud gemma4:31b-cloud, Gemma Unit Test Response, Ollama Cloud qwen3-coder-next:cloud, Qwen Unit Test Response, Response Latency and Throughput, Good Unit Test Prompt, Unit Test Quality Principles

### Community 37 - "Documentation Site Delivery"
Cohesion: 0.38
Nodes (7): Local AI Chat Studio Code Tutorial, Contribution Guide, Documentation Site Shell, Local AI Chat Studio, Security Policy, Documentation Site Implementation Plan, Documentation Site Task Status

### Community 38 - "TypeScript Project References"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, ignoreDeprecations, paths, files, references

### Community 39 - "API Contract Tests"
Cohesion: 0.48
Nodes (6): TestClient, test_conversation_crud_preserves_message_order(), test_health_and_session_cookie(), test_openrouter_auth_uses_session_pkce_and_current_callback_origin(), test_provider_secret_is_scoped_to_browser_session(), test_run_stream_contract_retains_completed_output()

### Community 40 - "Generated Graph Save"
Cohesion: 0.33
Nodes (5): [assembledPath, scanPath, graphOutputPath, fingerprintInputPath, projectRoot, gitCommitHash], fs, graph, scan, sourceFilePaths

### Community 41 - "Generated Graph Metadata"
Cohesion: 0.33
Nodes (5): fs, graph, [graphPath, scanPath, metaPath, gitCommitHash], meta, scan

### Community 42 - "Platform Hero Artwork"
Cohesion: 0.40
Nodes (5): Layered Platform Hero, Layered Architecture Metaphor, Lower Platform, Upper Layer, Vertical Connectors

### Community 43 - "Vite Brand Asset"
Cohesion: 0.40
Nodes (5): Adaptive Parenthesis Contrast, Purple Cyan Glow, Purple Lightning Bolt, Enclosing Parentheses, Vite Logo

### Community 44 - "Continuous Integration Pipeline"
Cohesion: 0.40
Nodes (5): Backend CI Job, CI Pipeline, Frontend CI Job, pytest, Ruff

### Community 45 - "Pull Request Quality Gates"
Cohesion: 0.50
Nodes (4): End-to-End Verification, Pull Request Review Contract, Secret and Model Hygiene, Worker and UI Separation

### Community 46 - "Release Changelog"
Cohesion: 0.50
Nodes (4): FastAPI v2 Backend, Native Provider Adapters, React Vite Frontend, Release 0.2.0

### Community 47 - "Contributor Conduct"
Cohesion: 0.50
Nodes (4): Code of Conduct, Contributor Covenant 2.1, Maintainer Enforcement, Welcoming Contribution Standard

### Community 51 - "Bug Report Workflow"
Cohesion: 0.67
Nodes (3): Bug Report Template, Reproduction Environment, Bug Reproduction Steps

### Community 52 - "App Favicon Design"
Cohesion: 0.67
Nodes (3): Application Favicon, Lightning Bolt, Neon Gradient

### Community 53 - "Documentation Source Icons"
Cohesion: 0.67
Nodes (3): Documentation, Documentation Icon, Source Code

### Community 54 - "Frontend Starter Guide"
Cohesion: 0.67
Nodes (3): Oxlint Type-aware Rules, React Compiler, React TypeScript Vite

### Community 55 - "React Brand Asset"
Cohesion: 0.67
Nodes (3): Atomic Orbit Motif, React, React Logo

### Community 56 - "Saved Graph Query Memory"
Cohesion: 0.67
Nodes (3): ModelInfo Boundary Contract, ModelInfo Lifecycle, Selected Model Runtime Handoff

## Knowledge Gaps
- **225 isolated node(s):** `fs`, `root`, `extracted`, `input`, `names` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ZERO_TO_HERO_STUDY_HANDBOOK.md` connect `Architecture Study Guide` to `User Product Guide`, `Backend API Runtime`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `add_message()` connect `Conversation Data Store` to `Backend API Runtime`, `Prompt Context Orchestration`, `Chat Generation Actions`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `cn()` connect `Shared UI Primitives` to `Responsive Sidebar UI`, `React Studio Shell`, `Dialog and Sheet UI`, `Dropdown Menu Components`, `Form Field Components`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `RunManager` (e.g. with `RunCreate` and `RunEvent`) actually correct?**
  _`RunManager` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `fs`, `root`, `extracted` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend API Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.06416978776529339 - nodes in this community are weakly interconnected._
- **Should `Conversation Data Store` be split into smaller, more focused modules?**
  _Cohesion score 0.09250693802035152 - nodes in this community are weakly interconnected._