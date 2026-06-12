"""BYOK provider management: API keys + OpenRouter account login.

Security: keys entered here are held only in the server's process memory for the
session — never written to disk, logged, or exported, and sent only to their own
provider. Restarting the app forgets them. Environment variables are a read-only
fallback. The password fields below also keep keys out of the page's plain text.
"""

import streamlit as st

from src import ollama_client, providers

st.set_page_config(page_title="Providers", page_icon="🔌", layout="centered")

st.title("🔌 Providers")
st.caption(
    "Bring your own keys. Models from every connected provider appear in the chat "
    "dropdown automatically — including models released after this app was written. "
    "🔒 Keys live **only in memory for this session** — never written to disk, logged, "
    "or exported, and sent only to the provider they belong to. Restarting forgets them."
)

# Finish OpenRouter OAuth if we were redirected back with ?code=
code = st.query_params.get("code")
if code:
    if providers.openrouter_exchange_code(code):
        st.success("✅ Signed in with OpenRouter — key held in memory for this session.")
    else:
        st.error("OpenRouter sign-in failed — try again or paste a key manually.")
    st.query_params.clear()

if providers.configured_providers() or providers.ollama_key_source():
    if st.button("🧹 Forget all keys (this session)"):
        providers.clear_all_secrets()
        ollama_client._client_cache.clear()
        st.success("All in-memory keys wiped.")

st.divider()

STATUS = {
    "session": "🟢 key in session",
    "env": None,  # filled per-provider with the env var name
    None: "⚪ not connected",
}

for pid, meta in providers.PROVIDERS.items():
    source = providers.key_source(pid)
    status = f"🟢 from ${meta['env']}" if source == "env" else STATUS[source]
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
            if st.button("Use key", key=f"save_{pid}", disabled=not key_input):
                providers.set_api_key(pid, key_input)
                st.rerun()
        with c2:
            if st.button("Test connection", key=f"test_{pid}", disabled=source is None):
                with st.spinner("Testing..."):
                    ok, msg = providers.test_connection(pid)
                (st.success if ok else st.error)(msg)
        with c3:
            if source == "session" and st.button("Forget key", key=f"rm_{pid}"):
                providers.remove_api_key(pid)
                st.rerun()

st.divider()
ollama_status = providers.ollama_key_source()
badge = {"session": "🟢 cloud key in session", "env": "🟢 from $OLLAMA_API_KEY", None: ""}[ollama_status]
st.subheader(f"Ollama endpoint {('— ' + badge) if badge else ''}")
st.markdown(
    "The app talks to Ollama at the endpoint below — by default a **local** server at "
    "`http://localhost:11434`. Three ways to use it:\n\n"
    "- **Local** (default): leave the host as-is, no key needed.\n"
    "- **Remote server**: set the host to your server's URL; add a Bearer key if it's secured.\n"
    "- **Ollama Cloud (no local install needed)**: click **Use Ollama Cloud**, then paste an "
    "Ollama API key from [ollama.com/settings/keys](https://ollama.com/settings/keys). Everything "
    "(chat, `:cloud` models, embeddings, vision) then runs on ollama.com."
)

if st.button("☁️ Use Ollama Cloud (ollama.com)"):
    providers.set_ollama_config(providers.OLLAMA_CLOUD_URL, providers.get_ollama_key())
    ollama_client._client_cache.clear()
    st.rerun()

ollama_host = st.text_input(
    "Ollama host URL",
    value=providers.get_ollama_host(),  # reflects current config each run
    placeholder="http://localhost:11434",
)
ollama_key = st.text_input(
    "Ollama API key",
    type="password",
    key="ollama_key_input",
    placeholder="Required for Ollama Cloud / secured servers; blank for a local server",
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
            st.error("Could not reach this Ollama endpoint. Check the URL and key.")
with oc3:
    if st.button("Reset to local"):
        providers.reset_ollama_config()
        ollama_client._client_cache.clear()
        st.rerun()

st.caption(
    "💡 No local Ollama at all? Set **Use Ollama Cloud** + an API key here, then open the chat "
    "page — it will connect to the cloud. Note: with a cloud-only setup, local-only features "
    "(auto memory, titles, RAG embeddings) need a local embedding/helper model to be active."
)

st.divider()
st.subheader("Ollama cloud models (`:cloud` tag)")
st.markdown(
    "Models tagged `:cloud` run on **ollama.com** under your Ollama account. With a local "
    "Ollama you can enable them by signing in once via `ollama signin`; or use the API-key "
    "path above. They appear in the dropdown automatically. Hide them via the toggle in **Settings**."
)
