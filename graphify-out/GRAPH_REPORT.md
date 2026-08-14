# Graph Report - D:\AI\Github\local-ai-chat-studio  (2026-08-15)

## Corpus Check
- 23 files · ~84,891 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 982 nodes · 1895 edges · 80 communities (49 shown, 31 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend API Contracts
- Run Data Models
- Provider Adapters
- Legacy Chat Persistence
- Sheet UI Components
- Dropdown UI Components
- Model Catalog and Ollama
- Legacy Application Modules
- Frontend Dependencies
- Frontend Lint Rules
- Run Lifecycle Management
- TypeScript App Configuration
- Retrieval and Vector Storage
- Project Documentation
- Workspace Feature Tests
- Frontend Chat Application
- Component Configuration
- Frontend API Client
- Node TypeScript Configuration
- Legacy Job Management
- Application Configuration
- Legacy Streaming Pipeline
- Card UI Components
- Field UI Components
- File Upload Processing
- Button and Dialog UI
- Memory Extraction Pipeline
- Model Pricing Metadata
- Backend API Tests
- Legacy Generation Workflow
- Application Settings
- Frontend App Features
- Frontend Error Handling
- Avatar UI Components
- Base TypeScript Configuration
- Sidebar UI Components
- OpenAPI Schema
- Tabs UI Components
- Hero Architecture Artwork
- Vite Brand Artwork
- Continuous Integration
- External Integrations
- Application Favicon
- Documentation Icon Artwork
- React Brand Artwork
- Badge UI Components
- Model Runtime Handoff
- Feature Request Template
- FastAPI Application Package
- Backend Package
- Testing Patterns
- API Error Handling
- Documentation Planning
- Regenerate Last Action
- Health Rendering
- Live Generation Rendering
- Preset Seeding
- Generation Start
- Type Utility
- Code of Conduct
- Dataset Documentation
- Development Conventions
- Technology Stack
- Codebase Structure
- Documentation Site
- Frontend Entrypoint
- Frontend Workspace Guide
- Bug Report Template
- Pull Request Template
- Graph Report
- Project Package Metadata
- Settings Export
- Settings Import
- Chroma Directory
- Database Path
- Directory Initialization
- Provider Secrets Vault

## God Nodes (most connected - your core abstractions)
1. `cn()` - 120 edges
2. `Store` - 82 edges
3. `create_app()` - 32 edges
4. `_conn()` - 32 edges
5. `RunManager` - 23 edges
6. `compilerOptions` - 21 edges
7. `utc_now()` - 20 edges
8. `_run()` - 19 edges
9. `ModelInfo` - 19 edges
10. `ProviderAdapter` - 18 edges

## Surprising Connections (you probably didn't know these)
- `app.send_user_message` --calls--> `add_message()`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/chat_store.py
- `Background worker pattern (daemon threads + Job registry)` --references--> `Job`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py
- `Code tutorial` --semantically_similar_to--> `Zero-to-Hero study handbook`  [INFERRED] [semantically similar]
  CODE_TUTORIAL.md → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `Parallel model comparison screenshot` --conceptually_related_to--> `User guide`  [INFERRED]
  docs/screenshot-compare.png → USER_GUIDE.md
- `Zero-to-Hero tutorial site` --semantically_similar_to--> `User guide`  [INFERRED] [semantically similar]
  docs/tutorial/index.html → USER_GUIDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Documentation Site Delivery** — tasks_plan_documentation_site_plan, tasks_todo_documentation_site_status [EXTRACTED 1.00]
- **Vite Brand Mark Composition** — frontend_src_assets_vite_lightning_bolt, frontend_src_assets_vite_parentheses, frontend_src_assets_vite_glowing_gradient [INFERRED 0.95]

## Communities (80 total, 31 thin omitted)

### Community 0 - "Backend API Contracts"
Cohesion: 0.07
Nodes (74): main(), Backpack, BackpackCreate, BackpackItem, BackpackItemInput, ChatMessage, ContextPlan, ContextSection (+66 more)

### Community 1 - "Run Data Models"
Cohesion: 0.06
Nodes (14): Message, utc_now(), Any, Conversation, RunEvent, RunSnapshot, Store, Backpack (+6 more)

### Community 2 - "Provider Adapters"
Cohesion: 0.07
Nodes (27): ABC, Any, AsyncClient, AnthropicAdapter, build_provider_registry(), GeminiAdapter, OllamaAdapter, OpenAICompatibleAdapter (+19 more)

### Community 3 - "Legacy Chat Persistence"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 4 - "Sheet UI Components"
Cohesion: 0.06
Nodes (36): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle(), Sidebar() (+28 more)

### Community 5 - "Dropdown UI Components"
Cohesion: 0.09
Nodes (29): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+21 more)

### Community 6 - "Model Catalog and Ollama"
Cohesion: 0.09
Nodes (35): ollama_client._client (cached client factory), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host(), get_ollama_key() (+27 more)

### Community 7 - "Legacy Application Modules"
Cohesion: 0.08
Nodes (30): Functional module style with typed data carriers, best_coding_model(), build_model_catalog(), normalize_model_key(), ordered_keys(), present_groups(), Unified model catalog shared by the chat page and the Compare page., Pick the best available model for the built-in Coding Agent preset. (+22 more)

### Community 8 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (32): @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, dependencies, @base-ui/react, class-variance-authority, clsx (+24 more)

### Community 9 - "Frontend Lint Rules"
Cohesion: 0.06
Nodes (32): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, devDependencies, jsdom, openapi-typescript (+24 more)

### Community 10 - "Run Lifecycle Management"
Cohesion: 0.13
Nodes (8): RunEvent, RunSnapshot, RunManager, RunState, _anthropic_wif_configured(), SessionVault, Exception, RunCreate

### Community 11 - "TypeScript App Configuration"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 12 - "Retrieval and Vector Storage"
Cohesion: 0.17
Nodes (25): Use the canonical Chroma index when configured, with a SQLite lexical fallback., retrieve_context(), clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector() (+17 more)

### Community 13 - "Project Documentation"
Cohesion: 0.12
Nodes (25): Changelog, Code tutorial, Contributing guide, Background worker pattern (daemon threads + Job registry), Zero-to-Hero Study Handbook, legacy v1 (PDF, Streamlit-only), Event-driven UI with Streamlit reruns, Context preflight, Architecture map (+17 more)

### Community 14 - "Workspace Feature Tests"
Cohesion: 0.20
Nodes (22): ModelDescriptor, fixture, client(), TestClient, _complete_echo_run(), _conversation(), TestClient, test_branch_backpack_focus_and_provider_policy() (+14 more)

### Community 15 - "Frontend Chat Application"
Cohesion: 0.11
Nodes (13): ProviderSummary, ChatWorkspace(), ComparePage(), comparisonModelKey(), ComparisonResult, ContextRail(), defaultPolicy, formatUsd() (+5 more)

### Community 16 - "Component Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 17 - "Frontend API Client"
Cohesion: 0.09
Nodes (19): api, Backpack, ContextPlan, Conversation, FocusSession, Memory, ModelSummary, OpenCodeAuthMethod (+11 more)

### Community 18 - "Node TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 19 - "Legacy Job Management"
Cohesion: 0.20
Nodes (15): _friendly_error(), get(), is_running(), Any, Background generation jobs. A chat reply runs in a daemon thread instead of…, DuckDuckGo search (no API key). Returns [{title, url, snippet}]; never raises., Turn a raw exception string into a clear, actionable chat message., Request cancellation. The UI stops showing the job immediately; the worker… (+7 more)

### Community 20 - "Application Configuration"
Cohesion: 0.15
Nodes (14): Application configuration via Pydantic Settings (env-overridable)., _maybe_extract(), Pinned memories + semantically relevant ones, capped, usage-bumped., relevant_memories(), build_messages(), Any, Assemble the per-turn message list: system prompt + retrieved context + history., Build the Ollama message list for this turn. Returns (messages,… (+6 more)

### Community 21 - "Legacy Streaming Pipeline"
Cohesion: 0.17
Nodes (16): jobs._stream, _client(), describe_image(), embed_texts(), list_models(), ollama_alive(), Any, Ollama integration: dynamic model discovery, capability checks, streaming chat.… (+8 more)

### Community 22 - "Card UI Components"
Cohesion: 0.14
Nodes (11): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), Input() (+3 more)

### Community 23 - "Field UI Components"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 24 - "File Upload Processing"
Cohesion: 0.19
Nodes (15): Attachment, chunk_text(), _ext(), _parse_docx(), _parse_excel(), _parse_legacy_doc(), _parse_pdf(), parse_upload() (+7 more)

### Community 25 - "Button and Dialog UI"
Cohesion: 0.16
Nodes (8): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 26 - "Memory Extraction Pipeline"
Cohesion: 0.20
Nodes (10): jobs._maybe_extract, _autotitle(), memory._parse_json_list, extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Tolerant JSON-list parser for small-model output (strips fences/prose). (+2 more)

### Community 27 - "Model Pricing Metadata"
Cohesion: 0.44
Nodes (8): ModelPricing, model_pricing(), openrouter_pricing(), _price(), test_catalog_returns_official_token_rates(), test_custom_openai_gateway_has_no_official_openai_price(), test_openrouter_converts_official_per_token_rates(), test_unknown_model_has_no_invented_price()

### Community 28 - "Backend API Tests"
Cohesion: 0.36
Nodes (9): TestClient, test_anthropic_reports_workload_identity_source(), test_conversation_crud_preserves_message_order(), test_health_and_session_cookie(), test_managed_server_can_be_stopped_from_the_local_ui(), test_openrouter_auth_uses_session_pkce_and_current_callback_origin(), test_provider_secret_is_scoped_to_browser_session(), test_run_stream_contract_retains_completed_output() (+1 more)

### Community 29 - "Legacy Generation Workflow"
Cohesion: 0.29
Nodes (7): app.send_user_message, Job, Spawn a background worker for one assistant reply and return its Job. Takes raw…, Fire-and-forget generation NOT tied to a conversation (model compare). Streams…, In-flight (or just-finished) generation for one conversation., run_ephemeral(), start()

### Community 30 - "Application Settings"
Cohesion: 0.32
Nodes (4): BaseSettings, Path, AppConfig, Settings for the local AI chat studio. Every field can be overridden with an…

### Community 31 - "Frontend App Features"
Cohesion: 0.25
Nodes (5): App(), fileAsBase64(), messageOf(), SettingsPage(), conversation

### Community 32 - "Frontend Error Handling"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 33 - "Avatar UI Components"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 34 - "Base TypeScript Configuration"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, ignoreDeprecations, paths, files, references

### Community 35 - "Sidebar UI Components"
Cohesion: 0.40
Nodes (5): react, SidebarMenuSkeleton(), SidebarProvider(), useIsMobile(), react

### Community 36 - "OpenAPI Schema"
Cohesion: 0.33
Nodes (5): components, $defs, operations, paths, webhooks

### Community 37 - "Tabs UI Components"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 38 - "Hero Architecture Artwork"
Cohesion: 0.40
Nodes (5): Layered Platform Hero, Layered Architecture Metaphor, Lower Platform, Upper Layer, Vertical Connectors

### Community 39 - "Vite Brand Artwork"
Cohesion: 0.40
Nodes (5): Adaptive Parenthesis Contrast, Purple Cyan Glow, Purple Lightning Bolt, Enclosing Parentheses, Vite Logo

### Community 40 - "Continuous Integration"
Cohesion: 0.40
Nodes (5): Backend CI Job, CI Pipeline, Frontend CI Job, pytest, Ruff

### Community 41 - "External Integrations"
Cohesion: 0.50
Nodes (4): External integrations, OpenCode loopback bridge, Model pricing metadata, Remote-provider context policy

### Community 42 - "Application Favicon"
Cohesion: 0.67
Nodes (3): Application Favicon, Lightning Bolt, Neon Gradient

### Community 43 - "Documentation Icon Artwork"
Cohesion: 0.67
Nodes (3): Documentation, Documentation Icon, Source Code

### Community 44 - "React Brand Artwork"
Cohesion: 0.67
Nodes (3): Atomic Orbit Motif, React, React Logo

### Community 46 - "Model Runtime Handoff"
Cohesion: 0.67
Nodes (3): ModelInfo Boundary Contract, ModelInfo Lifecycle, Selected Model Runtime Handoff

## Knowledge Gaps
- **169 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `$schema` (+164 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Store` connect `Run Data Models` to `Backend API Contracts`, `Provider Adapters`, `Run Lifecycle Management`, `Retrieval and Vector Storage`, `Workspace Feature Tests`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `cn()` connect `Dropdown UI Components` to `Avatar UI Components`, `Sidebar UI Components`, `Sheet UI Components`, `Tabs UI Components`, `Badge UI Components`, `Card UI Components`, `Field UI Components`, `Button and Dialog UI`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Backend API Contracts` to `Run Data Models`, `Provider Adapters`, `Run Lifecycle Management`, `Retrieval and Vector Storage`, `Workspace Feature Tests`, `File Upload Processing`, `Backend API Tests`, `Application Settings`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `Store` (e.g. with `RunManager` and `RunState`) actually correct?**
  _`Store` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _169 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend API Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.07023214810461358 - nodes in this community are weakly interconnected._
- **Should `Run Data Models` be split into smaller, more focused modules?**
  _Cohesion score 0.0636523266022827 - nodes in this community are weakly interconnected._