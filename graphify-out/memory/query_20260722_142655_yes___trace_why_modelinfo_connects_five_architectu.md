---
type: "query"
date: "2026-07-22T14:26:55.108224+00:00"
question: "yes - trace why ModelInfo connects five architectural communities"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ModelInfo", "build_model_catalog()", "app.py", "smallest_text_model()", "SelectedModel", "list_models()", "embedding_model()"]
---

# Q: yes - trace why ModelInfo connects five architectural communities

## Answer

Expanded from original query via graph vocab: [model, info, catalog, labels, main, chat, ollama, client, health, presets, compare, embedding]. ModelInfo is the canonical Ollama model-metadata contract. Catalog and label helpers consume its size and capability methods; the main UI imports and caches it; Ollama selection helpers use it for text, vision, and embedding choices; SelectedModel associates it with preset/catalog selection; and list_models exposes it to the Compare page. All direct edges are EXTRACTED except SelectedModel uses ModelInfo, which is INFERRED. This makes ModelInfo a high-fan-out boundary type: changing its fields or capability semantics affects catalog labels, main chat, client selection, compare, and embedding selection.

## Outcome

- Signal: useful

## Source Nodes

- ModelInfo
- build_model_catalog()
- app.py
- smallest_text_model()
- SelectedModel
- list_models()
- embedding_model()