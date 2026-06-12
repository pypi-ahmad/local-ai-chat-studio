"""BYOK provider management: API keys + OpenRouter account login."""

import streamlit as st

from src import providers
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
st.subheader("Ollama cloud models")
st.markdown(
    "Models tagged `:cloud` run on **ollama.com** under your Ollama account (not on disk). "
    "They appear in the dropdown automatically. To enable them, sign in once from a "
    "terminal with `ollama signin`. To hide them, use the toggle in **Settings**."
)
