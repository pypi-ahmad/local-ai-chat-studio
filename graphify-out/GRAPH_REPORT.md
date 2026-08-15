# Graph Report - .  (2026-08-15)

## Corpus Check
- 147 files · ~119,479 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1267 nodes · 2928 edges · 91 communities (63 shown, 28 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 154 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Workspace Persistence Store
- Backend API Composition
- Legacy Chat Persistence
- Frontend Runtime Dependencies
- Frontend Development Tooling
- React Application Shell
- Legacy Provider Integration
- Chat Composer Workspace
- Sidebar UI Components
- Legacy Model Catalog
- Workspace Route Pages
- Typed API Tooling
- Shared Form Components
- Attachment Job Processing
- Provider Adapter Tests
- Run Lifecycle Management
- Context Planning Pipeline
- Library Knowledge Workspace
- Browser TypeScript Configuration
- Cross Platform Launchers
- Workspace Feature Tests
- Project Documentation
- Knowledge Base Persistence
- Vector Retrieval Pipeline
- Ollama Client Integration
- UI Component Configuration
- Model Selection Features
- React Integration Tests
- Rich Message Rendering
- Node TypeScript Configuration
- OpenCode Streaming Bridge
- MCP Security Tests
- Context Evidence Interface
- Field Form Components
- Provider Discovery Contracts
- API Contract Tests
- Legacy Personalization Pipeline
- Memory Extraction Pipeline
- MCP Domain Contracts
- Pricing Metadata Integration
- MCP Transport Gateway
- Memory Provider Extraction
- File Parsing Pipeline
- Responsive Sheet Components
- Frontend Lint Configuration
- Application Data Paths
- Shared Utility Components
- Workspace Preference State
- Route Error Recovery
- Legacy Error Recovery
- Legacy TypeScript Paths
- Architecture Illustration Assets
- Vite Branding Assets
- Tooltip UI Components
- Provider Integration Documentation
- Continuous Integration Testing
- Application Brand Icon
- Documentation Brand Assets
- React Brand Assets
- Model Lifecycle Diagram
- Feature Request Template
- FastAPI Package Metadata
- Legacy Response Access
- Backend Package Metadata
- Documentation Planning
- Legacy Regeneration Action
- Legacy Health Rendering
- Legacy Generation Rendering
- Legacy Preset Seeding
- Legacy Generation Startup
- Community Standards Guide
- Dataset Policy Guide
- Development Conventions
- Technology Stack Reference
- Codebase Structure Reference
- Documentation Website
- Frontend Application Entry
- Frontend Workspace Guide
- Bug Report Template
- Pull Request Template
- Graph Audit Report
- Project Package Metadata
- Legacy Settings Export
- Legacy Settings Import
- Legacy Chroma Path
- Legacy Database Path
- Legacy Directory Setup
- Legacy Secret Vault

## God Nodes (most connected - your core abstractions)
1. `Store` - 122 edges
2. `cn()` - 120 edges
3. `SPAStaticFiles` - 60 edges
4. `create_app()` - 39 edges
5. `react` - 37 edges
6. `_conn()` - 32 edges
7. `utc_now()` - 29 edges
8. `ChatMessage` - 27 edges
9. `RunManager` - 24 edges
10. `ModelDescriptor` - 22 edges

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

## Communities (91 total, 28 thin omitted)

### Community 0 - "Workspace Persistence Store"
Cohesion: 0.05
Nodes (17): utc_now(), Any, Conversation, McpServer, RunEvent, RunSnapshot, Store, ConversationSettings (+9 more)

### Community 1 - "Backend API Composition"
Cohesion: 0.13
Nodes (52): Backpack, BackpackItem, BackpackItemInput, Conversation, ConversationBranch, ConversationCreate, ConversationSettings, ConversationUpdate (+44 more)

### Community 2 - "Legacy Chat Persistence"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 3 - "Frontend Runtime Dependencies"
Cohesion: 0.05
Nodes (39): @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, dependencies, @base-ui/react, class-variance-authority, clsx (+31 more)

### Community 4 - "Frontend Development Tooling"
Cohesion: 0.05
Nodes (38): devDependencies, jsdom, openapi-typescript, oxlint, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, @types/node (+30 more)

### Community 5 - "React Application Shell"
Cohesion: 0.09
Nodes (35): ollama_client._client (cached client factory), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host(), get_ollama_key() (+27 more)

### Community 6 - "Legacy Provider Integration"
Cohesion: 0.08
Nodes (27): streamRun(), App(), defaultConversationSettings, downloadFile(), messageOf(), Navigation(), navigationGroups, RoutedApp() (+19 more)

### Community 7 - "Chat Composer Workspace"
Cohesion: 0.12
Nodes (28): ConversationExportFormat, ConversationSettings, ProviderSummary, ReasoningEffort, DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuGroup() (+20 more)

### Community 8 - "Sidebar UI Components"
Cohesion: 0.08
Nodes (30): react, Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction() (+22 more)

### Community 9 - "Legacy Model Catalog"
Cohesion: 0.10
Nodes (24): Functional module style with typed data carriers, best_coding_model(), build_model_catalog(), normalize_model_key(), ordered_keys(), present_groups(), Unified model catalog shared by the chat page and the Compare page., Pick the best available model for the built-in Coding Agent preset. (+16 more)

### Community 10 - "Workspace Route Pages"
Cohesion: 0.23
Nodes (18): api, Surface(), Button(), buttonVariants, Card(), CardContent(), CardDescription(), CardHeader() (+10 more)

### Community 11 - "Typed API Tooling"
Cohesion: 0.08
Nodes (23): ApiError, FocusSession, McpServer, McpServerCreate, McpTool, OpenCodeAuthMethod, OpenCodeAuthStart, Preset (+15 more)

### Community 12 - "Shared Form Components"
Cohesion: 0.13
Nodes (26): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), CardAction(), CardFooter() (+18 more)

### Community 13 - "Attachment Job Processing"
Cohesion: 0.13
Nodes (24): app.send_user_message, _friendly_error(), get(), is_running(), Job, _process_attachments(), Any, Background generation jobs. A chat reply runs in a daemon thread instead of… (+16 more)

### Community 14 - "Provider Adapter Tests"
Cohesion: 0.14
Nodes (17): ChatMessage, build_provider_registry(), GeminiAdapter, OllamaAdapter, OpenAICompatibleAdapter, Client, MonkeyPatch, test_agnes_provider_uses_official_openai_compatible_endpoint() (+9 more)

### Community 15 - "Run Lifecycle Management"
Cohesion: 0.13
Nodes (8): RunEvent, RunSnapshot, RunManager, RunState, _anthropic_wif_configured(), SessionVault, Exception, RunCreate

### Community 16 - "Context Planning Pipeline"
Cohesion: 0.13
Nodes (24): main(), ContextPlan, ContextSection, ContextSource, ImageInput, SafetyFinding, create_app(), assemble_messages() (+16 more)

### Community 17 - "Library Knowledge Workspace"
Cohesion: 0.15
Nodes (20): Backpack, Conversation, KnowledgeBase, KnowledgeBaseCreate, Memory, Upload, Badge(), badgeVariants (+12 more)

### Community 18 - "Browser TypeScript Configuration"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 19 - "Cross Platform Launchers"
Cohesion: 0.16
Nodes (24): app_healthy(), clear_local_port(), download(), download_stdout(), fail(), files_fingerprint(), frontend_build_fingerprint(), frontend_install_fingerprint() (+16 more)

### Community 20 - "Workspace Feature Tests"
Cohesion: 0.22
Nodes (25): _complete_echo_run(), _conversation(), TestClient, test_api_migrates_the_legacy_five_column_preset_table(), test_bound_knowledge_base_supplies_existing_local_sources(), test_branch_backpack_focus_and_provider_policy(), test_cloud_preflight_warns_about_secrets_and_excludes_private_context(), test_context_budget_prunes_sources_and_private_text_can_be_sanitized() (+17 more)

### Community 21 - "Project Documentation"
Cohesion: 0.12
Nodes (25): Changelog, Code tutorial, Contributing guide, Background worker pattern (daemon threads + Job registry), Zero-to-Hero Study Handbook, legacy v1 (PDF, Streamlit-only), Event-driven UI with Streamlit reruns, Context preflight, Architecture map (+17 more)

### Community 22 - "Knowledge Base Persistence"
Cohesion: 0.16
Nodes (7): BackpackCreate, KnowledgeBaseSource, KnowledgeBaseSourceInput, Backpack, KnowledgeBase, KnowledgeBaseCreate, Memory

### Community 23 - "Vector Retrieval Pipeline"
Cohesion: 0.18
Nodes (23): clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector(), _embed(), _flatten() (+15 more)

### Community 24 - "Ollama Client Integration"
Cohesion: 0.24
Nodes (19): ModelSummary, contextLengthLabel(), hasTools(), hasVision(), modelKey(), modelSearchText(), pricingLabel(), providerMonogram() (+11 more)

### Community 25 - "UI Component Configuration"
Cohesion: 0.11
Nodes (22): jobs._stream, _client(), describe_image(), embed_texts(), embedding_model(), list_models(), ollama_alive(), Any (+14 more)

### Community 26 - "Model Selection Features"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 27 - "React Integration Tests"
Cohesion: 0.10
Nodes (15): activityRuns, conversation, conversationMessages, conversationSettings, defaultConversationSettings, knowledgeBases, libraryBackpacks, libraryMemories (+7 more)

### Community 28 - "Rich Message Rendering"
Cohesion: 0.22
Nodes (12): CodeBlock(), loadMermaid(), markdownComponents, MarkdownContent(), MermaidDiagram(), textOf(), Artifact, artifactFromFence() (+4 more)

### Community 29 - "Node TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 30 - "OpenCode Streaming Bridge"
Cohesion: 0.20
Nodes (4): AsyncClient, OpenCodeBridgeAdapter, Any, test_opencode_bridge_rejects_non_loopback_urls()

### Community 31 - "MCP Security Tests"
Cohesion: 0.26
Nodes (12): fixture, client(), TestClient, FakeMcpGateway, make_client(), Any, TestClient, stdio_server() (+4 more)

### Community 32 - "Context Evidence Interface"
Cohesion: 0.19
Nodes (13): ContextPlan, RunSnapshot, Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), ContextEvidenceInspector() (+5 more)

### Community 33 - "Field Form Components"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 34 - "Provider Discovery Contracts"
Cohesion: 0.19
Nodes (7): ModelDescriptor, ProviderDiscovery, AnthropicAdapter, OpenCodeZenAdapter, ProviderRegistry, OpenCode Zen exposes several model families through their native protocols., test_model_discovery_is_concurrent_and_degrades_per_provider()

### Community 35 - "API Contract Tests"
Cohesion: 0.25
Nodes (14): FastAPI, TestClient, test_anthropic_reports_workload_identity_source(), test_conversation_can_start_with_assistant_settings(), test_conversation_crud_preserves_message_order(), test_conversation_folder_is_persisted_and_searchable(), test_conversation_settings_are_saved_independently(), test_health_and_session_cookie() (+6 more)

### Community 36 - "Legacy Personalization Pipeline"
Cohesion: 0.18
Nodes (12): Application configuration via Pydantic Settings (env-overridable)., _maybe_extract(), build_messages(), Any, Assemble the per-turn message list: system prompt + retrieved context + history., Build the Ollama message list for this turn. Returns (messages,…, get_profile(), note_conversation_done() (+4 more)

### Community 37 - "Memory Extraction Pipeline"
Cohesion: 0.16
Nodes (12): jobs._maybe_extract, _autotitle(), memory._parse_json_list, extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Pinned memories + semantically relevant ones, capped, usage-bumped. (+4 more)

### Community 38 - "MCP Domain Contracts"
Cohesion: 0.19
Nodes (8): McpServer, McpServerCreate, McpGateway, redact_value(), safe_result_preview(), field_validator, model_validator, Protocol

### Community 39 - "Pricing Metadata Integration"
Cohesion: 0.36
Nodes (9): ABC, ModelPricing, model_pricing(), openrouter_pricing(), _price(), test_catalog_returns_official_token_rates(), test_custom_openai_gateway_has_no_official_openai_price(), test_openrouter_converts_official_per_token_rates() (+1 more)

### Community 40 - "MCP Transport Gateway"
Cohesion: 0.30
Nodes (5): DefaultMcpGateway, _public_remote_url(), Any, McpServer, Path

### Community 41 - "Memory Provider Extraction"
Cohesion: 0.32
Nodes (11): _category(), _complete(), _consolidation_prompt(), extract_memories(), ExtractionOutcome, _parse_memories(), Conversation, _selection_prompt() (+3 more)

### Community 42 - "File Parsing Pipeline"
Cohesion: 0.26
Nodes (11): Attachment, _ext(), _parse_docx(), _parse_excel(), _parse_legacy_doc(), _parse_pdf(), parse_upload(), Parse uploaded files into text, and prepare images for vision models. (+3 more)

### Community 43 - "Responsive Sheet Components"
Cohesion: 0.18
Nodes (7): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 44 - "Frontend Lint Configuration"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 45 - "Application Data Paths"
Cohesion: 0.32
Nodes (4): BaseSettings, AppConfig, Path, Settings for the local AI chat studio. Every field can be overridden with an…

### Community 46 - "Shared Utility Components"
Cohesion: 0.25
Nodes (4): ScrollArea(), ScrollBar(), Skeleton(), Switch()

### Community 47 - "Workspace Preference State"
Cohesion: 0.46
Nodes (6): InspectorTab, readHistoryWidth(), readInspectorTab(), useWorkspacePreferences(), readStoredBoolean(), writeStoredBoolean()

### Community 48 - "Route Error Recovery"
Cohesion: 0.29
Nodes (3): Props, RouteErrorBoundary, State

### Community 49 - "Legacy Error Recovery"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 50 - "Legacy TypeScript Paths"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, ignoreDeprecations, paths, files, references

### Community 51 - "Architecture Illustration Assets"
Cohesion: 0.40
Nodes (5): Layered Platform Hero, Layered Architecture Metaphor, Lower Platform, Upper Layer, Vertical Connectors

### Community 52 - "Vite Branding Assets"
Cohesion: 0.40
Nodes (5): Adaptive Parenthesis Contrast, Purple Cyan Glow, Purple Lightning Bolt, Enclosing Parentheses, Vite Logo

### Community 53 - "Tooltip UI Components"
Cohesion: 0.40
Nodes (4): Tooltip(), TooltipContent(), TooltipProvider(), TooltipTrigger()

### Community 54 - "Provider Integration Documentation"
Cohesion: 0.50
Nodes (4): External integrations, OpenCode loopback bridge, Model pricing metadata, Remote-provider context policy

### Community 55 - "Continuous Integration Testing"
Cohesion: 0.50
Nodes (4): Contract and lifecycle testing, Testing patterns, Continuous integration workflow, Python and frontend CI checks

### Community 56 - "Application Brand Icon"
Cohesion: 0.67
Nodes (3): Application Favicon, Lightning Bolt, Neon Gradient

### Community 57 - "Documentation Brand Assets"
Cohesion: 0.67
Nodes (3): Documentation, Documentation Icon, Source Code

### Community 58 - "React Brand Assets"
Cohesion: 0.67
Nodes (3): Atomic Orbit Motif, React, React Logo

### Community 59 - "Model Lifecycle Diagram"
Cohesion: 0.67
Nodes (3): ModelInfo Boundary Contract, ModelInfo Lifecycle, Selected Model Runtime Handoff

## Knowledge Gaps
- **207 isolated node(s):** `UV_PYTHON_INSTALL_DIR`, `UV_CACHE_DIR`, `UV_PROJECT_ENVIRONMENT`, `npm_config_cache`, `PATH` (+202 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Store` connect `Workspace Persistence Store` to `Backend API Composition`, `MCP Domain Contracts`, `Run Lifecycle Management`, `Context Planning Pipeline`, `Workspace Feature Tests`, `Knowledge Base Persistence`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Runtime Dependencies` to `Sidebar UI Components`, `Frontend Development Tooling`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `react` connect `Sidebar UI Components` to `Frontend Runtime Dependencies`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `Store` (e.g. with `SPAStaticFiles` and `RunManager`) actually correct?**
  _`Store` has 27 INFERRED edges - model-reasoned connections that need verification._
- **Are the 54 inferred relationships involving `SPAStaticFiles` (e.g. with `Backpack` and `BackpackCreate`) actually correct?**
  _`SPAStaticFiles` has 54 INFERRED edges - model-reasoned connections that need verification._
- **What connects `UV_PYTHON_INSTALL_DIR`, `UV_CACHE_DIR`, `UV_PROJECT_ENVIRONMENT` to the rest of the system?**
  _207 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Workspace Persistence Store` be split into smaller, more focused modules?**
  _Cohesion score 0.05171907140758154 - nodes in this community are weakly interconnected._