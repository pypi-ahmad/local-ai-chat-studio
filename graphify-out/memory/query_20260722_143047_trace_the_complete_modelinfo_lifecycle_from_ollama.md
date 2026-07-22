---
type: "query"
date: "2026-07-22T14:30:47.168682+00:00"
question: "Trace the complete ModelInfo lifecycle from Ollama discovery through UI selection and specialized model choice"
contributor: "graphify"
outcome: "useful"
source_nodes: ["_client()", "list_models()", "ModelInfo", "chat_models()", "build_model_catalog()", "SelectedModel", "dropdown_label()", "cached_models()", "start_generation()", "_models()"]
---

# Q: Trace the complete ModelInfo lifecycle from Ollama discovery through UI selection and specialized model choice

## Answer

Expanded from graph vocabulary: [ollama, model, info, discovery, catalog, labels, selected, chat, compare, embedding, dropdown, capability]. Extracted lifecycle: list_models calls _client and fetches all models from /api/tags as ModelInfo values. ModelInfo supplies model size and vision, embedding, and thinking capabilities. build_model_catalog consumes ModelInfo and ApiModel, calls chat_models and hint_for, and produces grouped SelectedModel entries. dropdown_label consumes ModelInfo and hint_for to form the displayed name, hint, and size. app.cached_models calls list_models, while start_generation calls cached_models and vision_fallback_model. The Compare page imports catalog helpers and its _models function calls list_models. embedding_model directly references ModelInfo to select the smallest capable local model; embed_texts calls _client. All statements are EXTRACTED except the SelectedModel-to-ModelInfo association, which is INFERRED. The graph has no direct data-flow edge from SelectedModel to stream_chat, so that runtime handoff remains unproven by this graph.

## Outcome

- Signal: useful

## Source Nodes

- _client()
- list_models()
- ModelInfo
- chat_models()
- build_model_catalog()
- SelectedModel
- dropdown_label()
- cached_models()
- start_generation()
- _models()
- embedding_model()
- embed_texts()