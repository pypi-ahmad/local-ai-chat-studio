# Graph Report - D:\AI\Github\local-ai-chat-studio  (2026-08-12)

## Corpus Check
- 106 files · ~75,644 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 996 nodes · 1924 edges · 85 communities (56 shown, 29 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend API Contracts
- Backend Data Store
- Provider Adapters and Memory
- Model Catalog and Ollama
- Legacy Chat Database
- Sidebar Sheet Components
- Menu Select Table Components
- Legacy Provider Settings
- Run Management Registry
- Frontend App TypeScript Config
- Retrieval Embedding Pipeline
- Frontend Chat Application
- Frontend Component Configuration
- Frontend Runtime Dependencies
- Architecture Tutorial Documentation
- Frontend API Client
- Node TypeScript Configuration
- Frontend Development Dependencies
- Workspace Feature Tests
- Card Input Switch Components
- Form Field Components
- File Upload Processing
- Background Job Management
- Button Dialog Components
- Memory Extraction Configuration
- Chat Interface Screenshots
- Automatic Titles Personalization
- Backend API Contract Tests
- Frontend Lint Configuration
- Ephemeral Job Execution
- Application Path Settings
- Model Comparison Screenshots
- Frontend Error Boundary
- Graph Analysis Reports
- Conversation Turn Orchestration
- Project Documentation Entry Points
- Frontend Package Scripts
- Avatar UI Components
- Base TypeScript Configuration
- Responsive Sidebar Support
- OpenAPI Schema Structure
- Tabs UI Components
- Documentation Governance Files
- Frontend Package Metadata
- Hero Architecture Artwork
- Vite Brand Artwork
- Continuous Integration Workflow
- Pull Request Template
- Frontend Application Tests
- Bug Report Template
- Favicon Brand Artwork
- Public Navigation Icons
- React Brand Artwork
- Badge UI Component
- Graph Memory Model Notes
- Feature Request Template
- Backend Package Initialization
- Backend Module Initialization
- DOM Testing Dependency
- Jest DOM Dependency
- React DOM Types
- Vite React Plugin
- API Client Error
- Regenerate Last Response
- Render Service Health
- Render Live Generation
- Seed Built In Presets
- Start Message Generation
- Release History Changelog
- Contribution Workflow Guide
- User Provided Datasets
- Engineering Concerns Documentation
- Development Conventions Documentation
- Python Package Definition
- Export Chat Settings
- Import Chat Settings
- Chroma Storage Directory
- Database File Path
- Ensure Application Directories
- Provider Secret Storage
- Technical Reference Documentation
- Usage Reference Documentation

## God Nodes (most connected - your core abstractions)
1. `cn()` - 120 edges
2. `Store` - 82 edges
3. `create_app()` - 42 edges
4. `_conn()` - 32 edges
5. `ChatMessage` - 25 edges
6. `RunManager` - 23 edges
7. `ProviderAdapter` - 22 edges
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
- `Functional module style with typed data carriers` --references--> `Job`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py
- `app.send_user_message` --calls--> `start()`  [EXTRACTED]
  docs/archive/ZERO_TO_HERO_STUDY_HANDBOOK.legacy-v1.pdf → src/jobs.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Frontend Verification Workflow** — frontend_readme_frontend_development, docs_codebase_testing_testing_strategy, docs_codebase_conventions_development_conventions [INFERRED 0.85]
- **Documentation Site Delivery** — tasks_plan_documentation_site_plan, docs_site_index_documentation_shell, tasks_todo_documentation_site_status [EXTRACTED 1.00]
- **Active Chat Session Setup** — docs_screenshot_chat_default_assistant, docs_screenshot_chat_ollama_local_provider, docs_screenshot_chat_deepseek_ocr_latest_model, docs_screenshot_chat_message_composer [EXTRACTED 1.00]
- **Parallel Model Comparison** — docs_screenshot_compare_compare_interface, docs_screenshot_compare_gemma4_31b_cloud, docs_screenshot_compare_qwen3_coder_next_cloud, docs_screenshot_compare_unit_test_prompt, docs_screenshot_compare_gemma_response, docs_screenshot_compare_qwen_response [EXTRACTED 1.00]
- **Vite Brand Mark Composition** — frontend_src_assets_vite_lightning_bolt, frontend_src_assets_vite_parentheses, frontend_src_assets_vite_glowing_gradient [INFERRED 0.95]

## Communities (85 total, 29 thin omitted)

### Community 0 - "Backend API Contracts"
Cohesion: 0.08
Nodes (65): main(), Backpack, BackpackCreate, BackpackItem, BackpackItemInput, ContextPlan, ContextSection, ContextSource (+57 more)

### Community 1 - "Backend Data Store"
Cohesion: 0.06
Nodes (13): utc_now(), Any, Conversation, RunEvent, RunSnapshot, Store, Backpack, FocusSession (+5 more)

### Community 2 - "Provider Adapters and Memory"
Cohesion: 0.09
Nodes (30): ABC, AsyncClient, ChatMessage, ModelDescriptor, ProviderDiscovery, _category(), _complete(), _consolidation_prompt() (+22 more)

### Community 3 - "Model Catalog and Ollama"
Cohesion: 0.05
Nodes (49): Background worker pattern (daemon threads + Job registry), Zero-to-Hero Study Handbook, legacy v1 (PDF, Streamlit-only), Event-driven UI with Streamlit reruns, Functional module style with typed data carriers, pyproject.toml - project metadata & dependencies, best_coding_model(), build_model_catalog(), normalize_model_key() (+41 more)

### Community 4 - "Legacy Chat Database"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 5 - "Sidebar Sheet Components"
Cohesion: 0.06
Nodes (36): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle(), Sidebar() (+28 more)

### Community 6 - "Menu Select Table Components"
Cohesion: 0.09
Nodes (29): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+21 more)

### Community 7 - "Legacy Provider Settings"
Cohesion: 0.09
Nodes (35): ollama_client._client (cached client factory), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host(), get_ollama_key() (+27 more)

### Community 8 - "Run Management Registry"
Cohesion: 0.11
Nodes (12): RunEvent, RunStatus, ProviderRegistry, RunEvent, RunSnapshot, RunManager, RunState, _anthropic_wif_configured() (+4 more)

### Community 9 - "Frontend App TypeScript Config"
Cohesion: 0.07
Nodes (26): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib (+18 more)

### Community 10 - "Retrieval Embedding Pipeline"
Cohesion: 0.17
Nodes (25): embed_texts(), Embed a batch of texts with the auto-detected Ollama embedding model., clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector() (+17 more)

### Community 11 - "Frontend Chat Application"
Cohesion: 0.10
Nodes (11): ProviderSummary, streamRun(), App(), ComparePage(), defaultPolicy, fileAsBase64(), messageOf(), navigation (+3 more)

### Community 12 - "Frontend Component Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "Frontend Runtime Dependencies"
Cohesion: 0.10
Nodes (21): @base-ui/react, class-variance-authority, clsx, @fontsource-variable/geist, dependencies, @base-ui/react, class-variance-authority, clsx (+13 more)

### Community 14 - "Architecture Tutorial Documentation"
Cohesion: 0.11
Nodes (21): FastAPI and React Architecture, SQLite and Chroma Persistence, Technology Stack, Codebase Structure, Async Run Lifecycle, Typed API Boundary, Inspectable Context Plan, Streaming Durable Runs (+13 more)

### Community 15 - "Frontend API Client"
Cohesion: 0.10
Nodes (18): api, Backpack, ContextPlan, Conversation, FocusSession, Memory, ModelSummary, OpenCodeAuthMethod (+10 more)

### Community 16 - "Node TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 17 - "Frontend Development Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, jsdom, openapi-typescript, oxlint, @testing-library/react, @types/node, @types/react, typescript (+11 more)

### Community 18 - "Workspace Feature Tests"
Cohesion: 0.29
Nodes (18): _complete_echo_run(), _conversation(), TestClient, test_branch_backpack_focus_and_provider_policy(), test_cloud_preflight_warns_about_secrets_and_excludes_private_context(), test_context_budget_prunes_sources_and_private_text_can_be_sanitized(), test_cross_chat_retrieval_has_provenance_and_can_be_excluded(), test_image_attachment_is_available_to_full_replay_but_not_redacted_share() (+10 more)

### Community 19 - "Card Input Switch Components"
Cohesion: 0.14
Nodes (11): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), Input() (+3 more)

### Community 20 - "Form Field Components"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 21 - "File Upload Processing"
Cohesion: 0.19
Nodes (15): Attachment, chunk_text(), _ext(), _parse_docx(), _parse_excel(), _parse_legacy_doc(), _parse_pdf(), parse_upload() (+7 more)

### Community 22 - "Background Job Management"
Cohesion: 0.23
Nodes (13): _friendly_error(), get(), is_running(), Any, Background generation jobs.  A chat reply runs in a daemon thread instead of b, DuckDuckGo search (no API key). Returns [{title, url, snippet}]; never raises., Turn a raw exception string into a clear, actionable chat message., Request cancellation. The UI stops showing the job immediately; the worker (+5 more)

### Community 23 - "Button Dialog Components"
Cohesion: 0.16
Nodes (8): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 24 - "Memory Extraction Configuration"
Cohesion: 0.17
Nodes (10): Application configuration via Pydantic Settings (env-overridable)., jobs._maybe_extract, memory._parse_json_list, extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Pinned memories + semantically relevant ones, capped, usage-bumped. (+2 more)

### Community 25 - "Chat Interface Screenshots"
Cohesion: 0.25
Nodes (11): Chat Configuration, Chat History Search, Chat Studio Interface, DeepSeek OCR Latest Model, Default Assistant, Document OCR and Vision, Message Composer, Ollama Local Provider (+3 more)

### Community 26 - "Automatic Titles Personalization"
Cohesion: 0.27
Nodes (9): _autotitle(), _maybe_extract(), generate(), Single non-streamed completion for internal tasks (titles, extraction)., note_conversation_done(), Rolling user profile: learns style and preferences from chats + feedback., Bump the counter; return True when a profile refresh is due., Regenerate the user profile from recent chats and feedback. (+1 more)

### Community 27 - "Backend API Contract Tests"
Cohesion: 0.36
Nodes (9): TestClient, test_anthropic_reports_workload_identity_source(), test_conversation_crud_preserves_message_order(), test_health_and_session_cookie(), test_managed_server_can_be_stopped_from_the_local_ui(), test_openrouter_auth_uses_session_pkce_and_current_callback_origin(), test_provider_secret_is_scoped_to_browser_session(), test_run_stream_contract_retains_completed_output() (+1 more)

### Community 28 - "Frontend Lint Configuration"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 29 - "Ephemeral Job Execution"
Cohesion: 0.29
Nodes (7): app.send_user_message, Job, Spawn a background worker for one assistant reply and return its Job.      Tak, Fire-and-forget generation NOT tied to a conversation (model compare).      St, In-flight (or just-finished) generation for one conversation., run_ephemeral(), start()

### Community 30 - "Application Path Settings"
Cohesion: 0.32
Nodes (4): BaseSettings, Path, AppConfig, Settings for the local AI chat studio.      Every field can be overridden with

### Community 31 - "Model Comparison Screenshots"
Cohesion: 0.46
Nodes (8): Model Compare Interface, Ollama Cloud gemma4:31b-cloud, Gemma Unit Test Response, Ollama Cloud qwen3-coder-next:cloud, Qwen Unit Test Response, Response Latency and Throughput, Good Unit Test Prompt, Unit Test Quality Principles

### Community 32 - "Frontend Error Boundary"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 33 - "Graph Analysis Reports"
Cohesion: 0.25
Nodes (8): Backend API Contracts, Chat Database Storage, God Nodes, Graph Report, Knowledge Gaps, Provider Adapter Layer, Retrieval and Embeddings, Run Lifecycle Management

### Community 34 - "Conversation Turn Orchestration"
Cohesion: 0.29
Nodes (7): after_turn_indexing(), build_messages(), Any, Assemble the per-turn message list: system prompt + retrieved context + history., Build the Ollama message list for this turn.      Returns (messages, reference, Embed the new turn into the cross-chat history index., get_profile()

### Community 35 - "Project Documentation Entry Points"
Cohesion: 0.33
Nodes (7): Architecture Tutorial, System Architecture, External Integrations, Testing Strategy, Frontend Application Entrypoint, Frontend Development, Zero-to-Hero Study Handbook

### Community 36 - "Frontend Package Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, generate:api, lint, preview, test

### Community 37 - "Avatar UI Components"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 38 - "Base TypeScript Configuration"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, ignoreDeprecations, paths, files, references

### Community 39 - "Responsive Sidebar Support"
Cohesion: 0.40
Nodes (5): react, SidebarMenuSkeleton(), SidebarProvider(), useIsMobile(), react

### Community 40 - "OpenAPI Schema Structure"
Cohesion: 0.33
Nodes (5): components, $defs, operations, paths, webhooks

### Community 41 - "Tabs UI Components"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 42 - "Documentation Governance Files"
Cohesion: 0.40
Nodes (5): Community Standards, Documentation Site Shell, Security Policy, Documentation Site Implementation Plan, Documentation Site Task Status

### Community 43 - "Frontend Package Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 44 - "Hero Architecture Artwork"
Cohesion: 0.40
Nodes (5): Layered Platform Hero, Layered Architecture Metaphor, Lower Platform, Upper Layer, Vertical Connectors

### Community 45 - "Vite Brand Artwork"
Cohesion: 0.40
Nodes (5): Adaptive Parenthesis Contrast, Purple Cyan Glow, Purple Lightning Bolt, Enclosing Parentheses, Vite Logo

### Community 46 - "Continuous Integration Workflow"
Cohesion: 0.40
Nodes (5): Backend CI Job, CI Pipeline, Frontend CI Job, pytest, Ruff

### Community 47 - "Pull Request Template"
Cohesion: 0.50
Nodes (4): End-to-End Verification, Pull Request Review Contract, Secret and Model Hygiene, Worker and UI Separation

### Community 49 - "Bug Report Template"
Cohesion: 0.67
Nodes (3): Bug Report Template, Reproduction Environment, Bug Reproduction Steps

### Community 50 - "Favicon Brand Artwork"
Cohesion: 0.67
Nodes (3): Application Favicon, Lightning Bolt, Neon Gradient

### Community 51 - "Public Navigation Icons"
Cohesion: 0.67
Nodes (3): Documentation, Documentation Icon, Source Code

### Community 52 - "React Brand Artwork"
Cohesion: 0.67
Nodes (3): Atomic Orbit Motif, React, React Logo

### Community 54 - "Graph Memory Model Notes"
Cohesion: 0.67
Nodes (3): ModelInfo Boundary Contract, ModelInfo Lifecycle, Selected Model Runtime Handoff

## Knowledge Gaps
- **178 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Store` connect `Backend Data Store` to `Backend API Contracts`, `Run Management Registry`, `Workspace Feature Tests`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `cn()` connect `Menu Select Table Components` to `Avatar UI Components`, `Sidebar Sheet Components`, `Responsive Sidebar Support`, `Tabs UI Components`, `Card Input Switch Components`, `Form Field Components`, `Badge UI Component`, `Button Dialog Components`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Backend API Contracts` to `Backend Data Store`, `Provider Adapters and Memory`, `Run Management Registry`, `Retrieval Embedding Pipeline`, `Workspace Feature Tests`, `File Upload Processing`, `Backend API Contract Tests`, `Application Path Settings`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `Store` (e.g. with `RunManager` and `RunState`) actually correct?**
  _`Store` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `create_app()` (e.g. with `Backpack` and `ContextPlan`) actually correct?**
  _`create_app()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _178 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend API Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.08295281582952815 - nodes in this community are weakly interconnected._