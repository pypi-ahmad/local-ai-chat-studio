# Contributing to Local AI Chat Studio

Thanks for your interest — contributions of all kinds are welcome: bug reports,
feature ideas, docs, and code. 🙌

## Quick start for contributors

```bash
# 1. Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/local-ai-chat-studio.git
cd local-ai-chat-studio

# 2. Set up the environment (Python 3.12 + uv)
uv sync

# 3. You need a running Ollama with at least one chat model + an embedding model
ollama pull granite4.1:3b      # or any small chat model
ollama pull embeddinggemma

# 4. Run the app
uv run streamlit run app.py
```

## How to contribute

1. **Open an issue first** for anything non-trivial — it avoids wasted work and
   lets us agree on the approach.
2. Create a feature branch: `git checkout -b feat/your-idea` (or `fix/...`).
3. Make your change. Keep it focused — one topic per PR.
4. **Verify it end-to-end in the running app** (not just "it compiles"). If it
   touches generation, test with at least one local model.
5. Open a pull request describing the *why*, what you changed, and how you
   tested it.

## Code style

- Python 3.12, **type hints everywhere**, Google-style docstrings on public
  functions.
- `loguru` for logging — never `print`.
- Match the structure that's there: UI in `app.py`/`pages/`, logic in `src/`,
  no Streamlit (`st.*`) calls inside `src/` workers (they run off the main
  thread).
- No hardcoded model names — model knowledge must come from runtime APIs
  (see `src/catalog.py` / `src/model_labels.py` for the pattern).
- **Never persist secrets.** API keys live in memory only (`src/providers.py`);
  any PR that writes a key to disk will be declined.

## Good first contributions

- New file-type parsers (`src/files.py`)
- Additional BYOK providers (`src/providers.py`)
- Better model-hint heuristics (`src/model_labels.py`)
- Tests (we'd love a `pytest` suite for `files`, `model_labels`, `chat_store`)
- UI polish, accessibility, translations

## Reporting bugs

Use the bug report template. Please include: OS, Python version, Ollama version,
the model you used, and the exact steps to reproduce. Logs from the terminal
running Streamlit help a lot.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
