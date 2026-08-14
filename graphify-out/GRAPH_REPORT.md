# Graph Report - .  (2026-08-14)

## Corpus Check
- 108 files · ~77,677 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 995 nodes · 1948 edges · 86 communities (52 shown, 34 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Conversation Contracts
- Provider Discovery
- Context Contracts
- Chat Persistence
- Application Entry
- Provider Catalog
- Frontend Package Dependencies React
- Run Lifecycle
- Docs Archive Zero To Hero
- Frontend Src Components Ui Card
- Frontend Tsconfig App
- Src Ollama Client Embed Texts
- Src Config
- Frontend Components
- Base Ui React
- Frontend Src Api Client
- Src Jobs Stream
- App Send User Message
- Frontend Tsconfig Node
- Frontend Package Devdependencies
- Frontend Src Api Client Api
- Project Documentation
- Frontend Src Components Ui Avatar
- Frontend Src Components Ui Dropdown
- Frontend Src Components Ui Field
- Src Files
- Frontend Src Components Ui Button
- Product Features
- Frontend Src Components Ui Sheet
- Src Jobs Maybe Extract
- Model Pricing
- Frontend Src Api Client Streamrun
- Frontend Oxlintrc
- Docs Screenshot Compare Compare Interface
- Frontend Src Errorboundary
- Frontend Package Scripts
- Frontend Tsconfig
- Frontend Src Api Schema
- Frontend Src Components Ui Tabs
- Legacy Architecture
- Frontend Package
- Frontend Src Assets Hero Image
- Frontend Src Assets Vite Adaptive
- CI Pipeline
- External Integrations
- Frontend Public Favicon Favicon
- Frontend Public Icons Documentation
- Frontend Src Assets React Atomic
- Frontend Src Components Ui Badge
- Model Boundary Contract
- Github Issue Template Feature Request
- Backend App Init
- Backend Init
- Docs Codebase Testing Contract Tests
- Frontend Package Devdependencies Testing Library
- Frontend Package Devdependencies Testing Library
- Frontend Package Devdependencies Types React
- Frontend Package Devdependencies Vitejs Plugin
- Frontend Src Api Client Apierror
- Tasks Plan Documentation Site Plan
- App Regenerate Last
- App Render Health
- App Render Live Generation
- App Seed Builtin Presets
- App Start Generation
- Code Of Conduct Community Standards
- Dataset User Provided Datasets
- Docs Codebase Conventions Development Conventions
- Docs Codebase Stack Document
- Docs Codebase Structure Document
- Docs Site Index Document
- Frontend Index Application Entrypoint
- Frontend Readme Document
- Github Issue Template Bug Report
- Github Pull Request Template Document
- Graph Report Document
- Pkg Local Ai Chat Studio
- Src Chat Store Export Settings
- Src Chat Store Import Settings
- Src Config Chroma Dir
- Src Config Db Path
- Src Config Ensure Dirs
- Src Providers Secrets

## God Nodes (most connected - your core abstractions)
1. `cn()` - 120 edges
2. `Store` - 82 edges
3. `create_app()` - 32 edges
4. `_conn()` - 32 edges
5. `ChatMessage` - 25 edges
6. `RunManager` - 23 edges
7. `ModelDescriptor` - 21 edges
8. `ProviderAdapter` - 21 edges
9. `compilerOptions` - 21 edges
10. `utc_now()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `app.send_user_message` --calls--> `add_message()`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/chat_store.py
- `Background worker pattern (daemon threads + Job registry)` --references--> `Job`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py
- `Code tutorial` --semantically_similar_to--> `Zero-to-Hero study handbook`  [INFERRED] [semantically similar]
  CODE_TUTORIAL.md → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `Zero-to-Hero Study Handbook, legacy v1 (PDF, Streamlit-only)` --references--> `RAG and vector retrieval`  [INFERRED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `Functional module style with typed data carriers` --references--> `Attachment`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/files.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Documentation Site Delivery** — tasks_plan_documentation_site_plan, tasks_todo_documentation_site_status [EXTRACTED 1.00]
- **Active Chat Session Setup** — docs_screenshot_chat_default_assistant, docs_screenshot_chat_ollama_local_provider, docs_screenshot_chat_deepseek_ocr_latest_model, docs_screenshot_chat_message_composer [EXTRACTED 1.00]
- **Parallel Model Comparison** — docs_screenshot_compare_compare_interface, docs_screenshot_compare_gemma4_31b_cloud, docs_screenshot_compare_qwen3_coder_next_cloud, docs_screenshot_compare_unit_test_prompt, docs_screenshot_compare_gemma_response, docs_screenshot_compare_qwen_response [EXTRACTED 1.00]
- **Vite Brand Mark Composition** — frontend_src_assets_vite_lightning_bolt, frontend_src_assets_vite_parentheses, frontend_src_assets_vite_glowing_gradient [INFERRED 0.95]

## Communities (86 total, 34 thin omitted)

### Community 0 - "Conversation Contracts"
Cohesion: 0.05
Nodes (18): Message, utc_now(), Any, Conversation, RunEvent, RunSnapshot, Store, Backpack (+10 more)

### Community 1 - "Provider Discovery"
Cohesion: 0.08
Nodes (34): ABC, AsyncClient, ChatMessage, ModelDescriptor, ProviderDiscovery, _category(), _complete(), _consolidation_prompt() (+26 more)

### Community 2 - "Context Contracts"
Cohesion: 0.09
Nodes (58): Backpack, BackpackCreate, BackpackItem, BackpackItemInput, ContextPlan, ContextSection, ContextSource, Conversation (+50 more)

### Community 3 - "Chat Persistence"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 4 - "Application Entry"
Cohesion: 0.11
Nodes (35): main(), create_app(), sanitize_text(), FastAPI, fixture, Export the FastAPI OpenAPI schema to JSON for openapi-typescript to consume., client(), TestClient (+27 more)

### Community 5 - "Provider Catalog"
Cohesion: 0.09
Nodes (35): ollama_client._client (cached client factory), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host(), get_ollama_key() (+27 more)

### Community 6 - "Frontend Package Dependencies React"
Cohesion: 0.07
Nodes (35): react, Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction() (+27 more)

### Community 7 - "Run Lifecycle"
Cohesion: 0.12
Nodes (11): RunCreate, RunStatus, RunEvent, RunSnapshot, RunManager, RunState, _anthropic_wif_configured(), SessionVault (+3 more)

### Community 8 - "Docs Archive Zero To Hero"
Cohesion: 0.10
Nodes (24): Functional module style with typed data carriers, best_coding_model(), build_model_catalog(), normalize_model_key(), ordered_keys(), present_groups(), Unified model catalog shared by the chat page and the Compare page., Pick the best available model for the built-in Coding Agent preset. (+16 more)

### Community 9 - "Frontend Src Components Ui Card"
Cohesion: 0.12
Nodes (27): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), ScrollArea() (+19 more)

### Community 10 - "Frontend Tsconfig App"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 11 - "Src Ollama Client Embed Texts"
Cohesion: 0.17
Nodes (25): embed_texts(), Embed a batch of texts with the auto-detected Ollama embedding model., clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector() (+17 more)

### Community 12 - "Src Config"
Cohesion: 0.14
Nodes (18): Application configuration via Pydantic Settings (env-overridable)., _autotitle(), _maybe_extract(), Background generation jobs. A chat reply runs in a daemon thread instead of…, generate(), Single non-streamed completion for internal tasks (titles, extraction)., after_turn_indexing(), build_messages() (+10 more)

### Community 13 - "Frontend Components"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 14 - "Base Ui React"
Cohesion: 0.10
Nodes (21): @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, dependencies, @base-ui/react, class-variance-authority, clsx (+13 more)

### Community 15 - "Frontend Src Api Client"
Cohesion: 0.10
Nodes (18): Backpack, ContextPlan, Conversation, FocusSession, Memory, ModelSummary, OpenCodeAuthMethod, OpenCodeAuthStart (+10 more)

### Community 16 - "Src Jobs Stream"
Cohesion: 0.12
Nodes (20): jobs._stream, _client(), describe_image(), embedding_model(), list_models(), ollama_alive(), Any, Ollama integration: dynamic model discovery, capability checks, streaming chat.… (+12 more)

### Community 17 - "App Send User Message"
Cohesion: 0.15
Nodes (19): app.send_user_message, _friendly_error(), get(), is_running(), Job, Any, Spawn a background worker for one assistant reply and return its Job. Takes raw…, Fire-and-forget generation NOT tied to a conversation (model compare). Streams… (+11 more)

### Community 18 - "Frontend Tsconfig Node"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 19 - "Frontend Package Devdependencies"
Cohesion: 0.11
Nodes (19): devDependencies, jsdom, openapi-typescript, oxlint, @testing-library/react, @types/node, @types/react, typescript (+11 more)

### Community 20 - "Frontend Src Api Client Api"
Cohesion: 0.13
Nodes (9): api, ChatWorkspace(), ContextRail(), defaultPolicy, formatUsd(), ModelPicker(), navigation, Page (+1 more)

### Community 21 - "Project Documentation"
Cohesion: 0.19
Nodes (18): Changelog, Code tutorial, Contributing guide, Context preflight, Architecture map, RunManager lifecycle, SQLite canonical store and Chroma retrieval, Codebase concerns (+10 more)

### Community 22 - "Frontend Src Components Ui Avatar"
Cohesion: 0.14
Nodes (10): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), Input(), Switch() (+2 more)

### Community 23 - "Frontend Src Components Ui Dropdown"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 24 - "Frontend Src Components Ui Field"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 25 - "Src Files"
Cohesion: 0.19
Nodes (15): Attachment, chunk_text(), _ext(), _parse_docx(), _parse_excel(), _parse_legacy_doc(), _parse_pdf(), parse_upload() (+7 more)

### Community 26 - "Frontend Src Components Ui Button"
Cohesion: 0.16
Nodes (8): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 27 - "Product Features"
Cohesion: 0.25
Nodes (11): Chat Configuration, Chat History Search, Chat Studio Interface, DeepSeek OCR Latest Model, Default Assistant, Document OCR and Vision, Message Composer, Ollama Local Provider (+3 more)

### Community 28 - "Frontend Src Components Ui Sheet"
Cohesion: 0.18
Nodes (7): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 29 - "Src Jobs Maybe Extract"
Cohesion: 0.20
Nodes (9): jobs._maybe_extract, memory._parse_json_list, extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Pinned memories + semantically relevant ones, capped, usage-bumped., Tolerant JSON-list parser for small-model output (strips fences/prose). (+1 more)

### Community 30 - "Model Pricing"
Cohesion: 0.44
Nodes (8): ModelPricing, model_pricing(), openrouter_pricing(), _price(), test_catalog_returns_official_token_rates(), test_custom_openai_gateway_has_no_official_openai_price(), test_openrouter_converts_official_per_token_rates(), test_unknown_model_has_no_invented_price()

### Community 31 - "Frontend Src Api Client Streamrun"
Cohesion: 0.20
Nodes (7): streamRun(), App(), ComparePage(), fileAsBase64(), messageOf(), SettingsPage(), conversation

### Community 32 - "Frontend Oxlintrc"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 33 - "Docs Screenshot Compare Compare Interface"
Cohesion: 0.46
Nodes (8): Model Compare Interface, Ollama Cloud gemma4:31b-cloud, Gemma Unit Test Response, Ollama Cloud qwen3-coder-next:cloud, Qwen Unit Test Response, Response Latency and Throughput, Good Unit Test Prompt, Unit Test Quality Principles

### Community 34 - "Frontend Src Errorboundary"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 35 - "Frontend Package Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, generate:api, lint, preview, test

### Community 36 - "Frontend Tsconfig"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, ignoreDeprecations, paths, files, references

### Community 37 - "Frontend Src Api Schema"
Cohesion: 0.33
Nodes (5): components, $defs, operations, paths, webhooks

### Community 38 - "Frontend Src Components Ui Tabs"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 39 - "Legacy Architecture"
Cohesion: 0.40
Nodes (5): Background worker pattern (daemon threads + Job registry), Zero-to-Hero Study Handbook, legacy v1 (PDF, Streamlit-only), Event-driven UI with Streamlit reruns, pyproject.toml - project metadata & dependencies, .streamlit/config.toml - theme/server config

### Community 40 - "Frontend Package"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 41 - "Frontend Src Assets Hero Image"
Cohesion: 0.40
Nodes (5): Layered Platform Hero, Layered Architecture Metaphor, Lower Platform, Upper Layer, Vertical Connectors

### Community 42 - "Frontend Src Assets Vite Adaptive"
Cohesion: 0.40
Nodes (5): Adaptive Parenthesis Contrast, Purple Cyan Glow, Purple Lightning Bolt, Enclosing Parentheses, Vite Logo

### Community 43 - "CI Pipeline"
Cohesion: 0.40
Nodes (5): Backend CI Job, CI Pipeline, Frontend CI Job, pytest, Ruff

### Community 44 - "External Integrations"
Cohesion: 0.50
Nodes (4): External integrations, OpenCode loopback bridge, Model pricing metadata, Remote-provider context policy

### Community 45 - "Frontend Public Favicon Favicon"
Cohesion: 0.67
Nodes (3): Application Favicon, Lightning Bolt, Neon Gradient

### Community 46 - "Frontend Public Icons Documentation"
Cohesion: 0.67
Nodes (3): Documentation, Documentation Icon, Source Code

### Community 47 - "Frontend Src Assets React Atomic"
Cohesion: 0.67
Nodes (3): Atomic Orbit Motif, React, React Logo

### Community 49 - "Model Boundary Contract"
Cohesion: 0.67
Nodes (3): ModelInfo Boundary Contract, ModelInfo Lifecycle, Selected Model Runtime Handoff

## Knowledge Gaps
- **175 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+170 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Store` connect `Conversation Contracts` to `Context Contracts`, `Application Entry`, `Run Lifecycle`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `cn()` connect `Frontend Src Components Ui Card` to `Frontend Package Dependencies React`, `Frontend Src Components Ui Tabs`, `Frontend Src Components Ui Badge`, `Frontend Src Components Ui Avatar`, `Frontend Src Components Ui Dropdown`, `Frontend Src Components Ui Field`, `Frontend Src Components Ui Button`, `Frontend Src Components Ui Sheet`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Application Entry` to `Conversation Contracts`, `Provider Discovery`, `Context Contracts`, `Run Lifecycle`, `Src Ollama Client Embed Texts`, `Src Files`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `Store` (e.g. with `RunManager` and `RunState`) actually correct?**
  _`Store` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _175 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Conversation Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.05473684210526316 - nodes in this community are weakly interconnected._
- **Should `Provider Discovery` be split into smaller, more focused modules?**
  _Cohesion score 0.07869742198100407 - nodes in this community are weakly interconnected._