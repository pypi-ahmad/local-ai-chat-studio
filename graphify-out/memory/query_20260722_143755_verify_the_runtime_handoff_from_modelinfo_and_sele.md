---
type: "query"
date: "2026-07-22T14:37:55.699407+00:00"
question: "Verify the runtime handoff from ModelInfo and SelectedModel to stream_chat by direct source inspection"
contributor: "graphify"
outcome: "corrected"
correction: "The ModelInfo-to-SelectedModel relationship is confirmed in src/catalog.py:53-67, not merely inferred. The selected runtime value reaches stream_chat through SelectedModel.provider/name -> jobs.start -> _run -> _stream."
source_nodes: ["ModelInfo", "build_model_catalog()", "SelectedModel", "start_generation()", "start()", "_run()", "_stream()", "stream_chat()", "run_ephemeral()"]
---

# Q: Verify the runtime handoff from ModelInfo and SelectedModel to stream_chat by direct source inspection

## Answer

Direct source inspection confirms the missing runtime bridge. build_model_catalog iterates ModelInfo values and constructs SelectedModel records. The Streamlit selectbox stores a SelectedModel key; start_generation resolves that key in session_state.catalog and passes sel.provider, sel.name, and sel.is_vision to jobs.start. jobs.start forwards provider and model_name unchanged into _run; _run calls _stream(provider, model_name, ...). _stream dispatches provider=ollama to ollama_client.stream_chat(model_name, ...) and all other providers to providers.stream_chat(provider, model_name, ...). Ollama stream_chat finally calls _client().chat(model=model_name). ModelInfo itself does not cross the worker boundary; scalar routing values do. Compare follows the same dispatch through run_ephemeral but does not persist to SQLite.

## Outcome

- Signal: corrected
- Correction: The ModelInfo-to-SelectedModel relationship is confirmed in src/catalog.py:53-67, not merely inferred. The selected runtime value reaches stream_chat through SelectedModel.provider/name -> jobs.start -> _run -> _stream.

## Source Nodes

- ModelInfo
- build_model_catalog()
- SelectedModel
- start_generation()
- start()
- _run()
- _stream()
- stream_chat()
- run_ephemeral()