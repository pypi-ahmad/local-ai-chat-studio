# Graph Report - .  (2026-07-22)

## Corpus Check
- Corpus is ~23,604 words - fits in a single context window. You may not need a graph.

## Summary
- 343 nodes · 606 edges · 22 communities (17 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- UI State and Jobs
- SQLite Persistence
- Cloud Provider Secrets
- Vector Retrieval Storage
- Main Chat Interface
- Project Governance Security
- Configuration and Attachments
- Model Catalog Labels
- Ollama Client Health
- RAG Memory Architecture
- Chat UI Screenshot
- Model Selection Presets
- Memory Extraction Retrieval
- Model Comparison Screenshot
- Compare Page Execution
- Bug Reporting Workflow
- Changelog Versioning
- Feature Request Workflow
- Provider Management Page
- Model Comparison Semantics
- Embedding Model Selection
- Project Package Root

## God Nodes (most connected - your core abstractions)
1. `_conn()` - 32 edges
2. `ModelInfo` - 20 edges
3. `_run()` - 14 edges
4. `_collection()` - 12 edges
5. `_now()` - 10 edges
6. `parse_upload()` - 10 edges
7. `ApiModel` - 10 edges
8. `_embed()` - 10 edges
9. `build_model_catalog()` - 9 edges
10. `Job` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Zero to Hero Study Handbook PDF` --semantically_similar_to--> `Zero to Hero Study Handbook`  [INFERRED] [semantically similar]
  ZERO_TO_HERO_STUDY_HANDBOOK.pdf → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `Runtime Architecture Study Guide` --semantically_similar_to--> `Event-Driven Streamlit UI`  [INFERRED] [semantically similar]
  ZERO_TO_HERO_STUDY_HANDBOOK.pdf → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `Chat Generation Flow` --semantically_similar_to--> `Context Assembly Pipeline`  [INFERRED] [semantically similar]
  ZERO_TO_HERO_STUDY_HANDBOOK.pdf → ZERO_TO_HERO_STUDY_HANDBOOK.md
- `Provider Abstraction` --semantically_similar_to--> `BYOK Cloud Providers`  [INFERRED] [semantically similar]
  ZERO_TO_HERO_STUDY_HANDBOOK.md → README.md
- `Session-Only API Keys` --semantically_similar_to--> `In-Memory API Key Vault`  [INFERRED] [semantically similar]
  SECURITY.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Local AI Platform Capabilities** — readme_local_first_architecture, readme_personalized_memory, readme_byok_cloud_providers, readme_retrieval_augmented_generation, readme_model_comparison [EXTRACTED 1.00]
- **Non-Blocking Chat Generation Flow** — zero_to_hero_study_handbook_event_driven_streamlit_ui, zero_to_hero_study_handbook_background_worker_pattern, zero_to_hero_study_handbook_context_assembly_pipeline, zero_to_hero_study_handbook_provider_abstraction [EXTRACTED 1.00]
- **Project Governance Artifacts** — readme_contribution_workflow, _github_issue_template_bug_report_bug_report, _github_issue_template_feature_request_feature_request, _github_pull_request_template_pull_request_review_contract, code_of_conduct_code_of_conduct, security_security_policy, changelog_project_changelog [INFERRED 0.85]
- **Active Chat Session Setup** — docs_screenshot_chat_default_assistant, docs_screenshot_chat_ollama_local_provider, docs_screenshot_chat_deepseek_ocr_latest_model, docs_screenshot_chat_message_composer [EXTRACTED 1.00]
- **Parallel Model Comparison** — docs_screenshot_compare_compare_interface, docs_screenshot_compare_gemma4_31b_cloud, docs_screenshot_compare_qwen3_coder_next_cloud, docs_screenshot_compare_unit_test_prompt, docs_screenshot_compare_gemma_response, docs_screenshot_compare_qwen_response [EXTRACTED 1.00]

## Communities (22 total, 5 thin omitted)

### Community 0 - "UI State and Jobs"
Cohesion: 0.07
Nodes (43): _maybe_extract_memories(), Memory manager: view, edit, pin, delete what the assistant knows about you., Settings: generation, features, data export., Application configuration via Pydantic Settings (env-overridable)., chunk_text(), Split text into overlapping chunks on paragraph boundaries where possible., _autotitle(), _friendly_error() (+35 more)

### Community 1 - "SQLite Persistence"
Cohesion: 0.09
Nodes (46): Connection, add_memory(), add_message(), clear_all_conversations(), _conn(), create_conversation(), decay_memories(), delete_conversation() (+38 more)

### Community 2 - "Cloud Provider Secrets"
Cohesion: 0.09
Nodes (35): cached_provider_models(), ApiModel, clear_all_secrets(), configured_providers(), _excluded(), get_api_key(), get_ollama_host(), get_ollama_key() (+27 more)

### Community 3 - "Vector Retrieval Storage"
Cohesion: 0.17
Nodes (25): embed_texts(), Embed a batch of texts with the auto-detected Ollama embedding model., clear_all_chat_vectors(), clear_all_vectors(), _collection(), conv_has_docs(), delete_conv_vectors(), delete_memory_vector() (+17 more)

### Community 4 - "Main Chat Interface"
Cohesion: 0.11
Nodes (21): apply_preset(), cached_models(), get_state(), _on_preset_change(), Local AI Chat Studio — ChatGPT-style UI over Ollama + BYOK cloud providers., Change active conversation, extracting memories from the one we leave., Queue a background generation with the current settings., Persist the user's message immediately and queue generation. (+13 more)

### Community 5 - "Project Governance Security"
Cohesion: 0.09
Nodes (24): End-to-End Verification, Pull Request Review Contract, Secret and Model Hygiene, Worker and UI Separation, Code of Conduct, Contributor Covenant 2.1, Maintainer Enforcement, Welcoming Contribution Standard (+16 more)

### Community 6 - "Configuration and Attachments"
Cohesion: 0.15
Nodes (14): BaseSettings, Path, AppConfig, Settings for the local AI chat studio.      Every field can be overridden with, Attachment, _ext(), _parse_docx(), _parse_excel() (+6 more)

### Community 7 - "Model Catalog Labels"
Cohesion: 0.17
Nodes (13): build_model_catalog(), Unified model catalog shared by the chat page and the Compare page., Unified {key: SelectedModel}, ordered and grouped by provider., dropdown_label(), hint_for(), Generate short use-hints for models from Ollama API metadata.  Purely rule-bas, A 2-3 word use hint, e.g. 'vision, reasoning' or 'coding, fast'., Full dropdown line: name — hint (size). (+5 more)

### Community 8 - "Ollama Client Health"
Cohesion: 0.17
Nodes (15): Tiny endpoint health row: latency + which models are loaded., render_health(), _client(), describe_image(), ollama_alive(), Any, Ollama integration: dynamic model discovery, capability checks, streaming chat., Small general-purpose local model — used for titles, fact extraction, profiles. (+7 more)

### Community 9 - "RAG Memory Architecture"
Cohesion: 0.17
Nodes (15): User-Provided Datasets, Background Generation Jobs, Cross-Chat Semantic Recall, File and Image Processing, Retrieval-Augmented Generation, Background Worker Pattern, Context Assembly Pipeline, Event-Driven Streamlit UI (+7 more)

### Community 10 - "Chat UI Screenshot"
Cohesion: 0.25
Nodes (11): Chat Configuration, Chat History Search, Chat Studio Interface, DeepSeek OCR Latest Model, Default Assistant, Document OCR and Vision, Message Composer, Ollama Local Provider (+3 more)

### Community 11 - "Model Selection Presets"
Cohesion: 0.20
Nodes (9): seed_builtin_presets(), best_coding_model(), ordered_keys(), present_groups(), Pick the best available model for the built-in Coding Agent preset., Uniform view over an Ollama model or a cloud-provider model., Keys ordered by (group_rank, group, name); optionally filtered to one group., Distinct provider groups present, in display order. (+1 more)

### Community 12 - "Memory Extraction Retrieval"
Cohesion: 0.25
Nodes (7): extract_memories(), _parse_json_list(), ChatGPT-style memory: extract durable facts from chats, retrieve per turn., Run fact extraction over a conversation; dedup and store. Returns # added., Pinned memories + semantically relevant ones, capped, usage-bumped., Tolerant JSON-list parser for small-model output (strips fences/prose)., relevant_memories()

### Community 13 - "Model Comparison Screenshot"
Cohesion: 0.46
Nodes (8): Model Compare Interface, Ollama Cloud gemma4:31b-cloud, Gemma Unit Test Response, Ollama Cloud qwen3-coder-next:cloud, Qwen Unit Test Response, Response Latency and Throughput, Good Unit Test Prompt, Unit Test Quality Principles

### Community 14 - "Compare Page Execution"
Cohesion: 0.32
Nodes (6): _label(), _models(), Side-by-side model compare: one prompt, two models, parallel streams., render_compare(), list_models(), Fetch all models Ollama knows about, with capabilities.      ``/api/tags`` car

### Community 15 - "Bug Reporting Workflow"
Cohesion: 0.67
Nodes (3): Bug Report Template, Reproduction Environment, Bug Reproduction Steps

### Community 16 - "Changelog Versioning"
Cohesion: 0.67
Nodes (3): Keep a Changelog, Project Changelog, Semantic Versioning

## Knowledge Gaps
- **20 isolated node(s):** `local-ai-chat-studio`, `Reproduction Environment`, `Bug Reproduction Steps`, `Feature Request Template`, `End-to-End Verification` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ModelInfo` connect `Model Catalog Labels` to `Main Chat Interface`, `Ollama Client Health`, `Model Selection Presets`, `Compare Page Execution`, `Embedding Model Selection`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `AppConfig` connect `Configuration and Attachments` to `UI State and Jobs`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ApiModel` connect `Cloud Provider Secrets` to `Model Catalog Labels`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `local-ai-chat-studio`, `Reproduction Environment`, `Bug Reproduction Steps` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI State and Jobs` be split into smaller, more focused modules?**
  _Cohesion score 0.07088989441930618 - nodes in this community are weakly interconnected._
- **Should `SQLite Persistence` be split into smaller, more focused modules?**
  _Cohesion score 0.09250693802035152 - nodes in this community are weakly interconnected._
- **Should `Cloud Provider Secrets` be split into smaller, more focused modules?**
  _Cohesion score 0.09176788124156546 - nodes in this community are weakly interconnected._