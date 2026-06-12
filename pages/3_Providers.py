"""BYOK provider management: API keys + OpenRouter account login."""

import streamlit as st

from src import ollama_client, providers
from src.config import config

st.set_page_config(page_title="Providers", page_icon="🔌", layout="centered")

st.title("🔌 Providers")
st.caption(
    "Bring your own keys. Models from every connected provider appear in the chat "
    "dropdown automatically — including models released after this app was written. "
    f"Keys are stored locally in `{config.data_dir}/providers.json` (never sent "
    "anywhere except the provider itself)."
)

# Finish OpenRouter OAuth if we were redirected back with ?code=
code = st.query_params.get("code")
if code:
    if providers.openrouter_exchange_code(code):
        st.success("✅ Signed in with OpenRouter — API key saved.")
    else:
        st.error("OpenRouter sign-in failed — try again or paste a key manually.")
    st.query_params.clear()

st.divider()

for pid, meta in providers.PROVIDERS.items():
    source = providers.key_source(pid)
    status = {"saved": "🟢 key saved", "env": f"🟢 from ${meta['env']}", None: "⚪ not connected"}[source]
    with st.expander(f"**{meta['label']}** — {status}", expanded=source is None and pid == "openai"):

        if meta.get("oauth"):
            st.markdown("**Option 1 — log in with your account** (recommended)")
            auth_url = providers.openrouter_auth_url("http://localhost:8503/Providers")
            st.link_button(f"Sign in with {meta['label']}", auth_url)
            st.markdown("**Option 2 — paste an API key**")
        else:
            st.markdown(
                f"Sign in to your {meta['label']} account to create a key, then paste it below. "
                f"({meta['label']} doesn't offer third-party app login — console keys only.)"
            )
            st.link_button(f"Open {meta['label']} console to sign in & create a key", meta["key_url"])

        key_input = st.text_input(
            "API key",
            type="password",
            key=f"key_{pid}",
            placeholder=f"Paste your {meta['label']} API key (or set ${meta['env']})",
        )
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("Save", key=f"save_{pid}", disabled=not key_input):
                providers.set_api_key(pid, key_input)
                st.rerun()
        with c2:
            if st.button("Test connection", key=f"test_{pid}", disabled=source is None):
                with st.spinner("Testing..."):
                    ok, msg = providers.test_connection(pid)
                (st.success if ok else st.error)(msg)
        with c3:
            if source == "saved" and st.button("Remove key", key=f"rm_{pid}"):
                providers.remove_api_key(pid)
                st.rerun()

st.divider()
st.subheader("Ollama endpoint")
st.markdown(
    "By default the app talks to a local Ollama at `http://localhost:11434`. "
    "Point it at a **remote Ollama server** or **Ollama's hosted API** by setting the "
    "host below; add a Bearer **API key** if the endpoint requires one (e.g. a "
    "secured remote or hosted Ollama). Local models, `:cloud` models, embeddings, "
    "and vision all flow through whatever endpoint you set here."
)
ollama_host = st.text_input(
    "Ollama host URL",
    value=providers.get_ollama_host(),
    key="ollama_host_input",
    placeholder="http://localhost:11434",
)
ollama_key = st.text_input(
    "Ollama API key (optional)",
    value="",
    type="password",
    key="ollama_key_input",
    placeholder="Leave blank for a local/unauthenticated server",
)
oc1, oc2, oc3 = st.columns(3)
with oc1:
    if st.button("Save endpoint"):
        providers.set_ollama_config(ollama_host, ollama_key or None)
        ollama_client._client_cache.clear()
        st.success("Saved. Hit ⟳ on the chat page to refresh models.")
with oc2:
    if st.button("Test"):
        providers.set_ollama_config(ollama_host, ollama_key or None)
        ollama_client._client_cache.clear()
        if ollama_client.ollama_alive():
            n = len(ollama_client.list_models())
            st.success(f"Connected — {n} models at this endpoint.")
        else:
            st.error("Could not reach this Ollama endpoint.")
with oc3:
    if st.button("Reset to local"):
        providers.reset_ollama_config()
        ollama_client._client_cache.clear()
        st.rerun()

if providers.get_ollama_key():
    st.caption("🔑 An API key is set for the Ollama endpoint.")

st.divider()
st.subheader("Ollama cloud models")
st.markdown(
    "Models tagged `:cloud` run on **ollama.com** under your Ollama account (not on disk). "
    "They appear in the dropdown automatically. To enable them, sign in once from a "
    "terminal with `ollama signin`. To hide them, use the toggle in **Settings**."
)
