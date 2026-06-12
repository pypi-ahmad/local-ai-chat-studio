"""Side-by-side model compare: one prompt, two models, parallel streams."""

import streamlit as st
from loguru import logger

from src import chat_store, jobs, providers
from src.catalog import PROVIDER_BADGES, build_model_catalog, ordered_keys
from src.config import config
from src.ollama_client import list_models, ollama_alive

st.set_page_config(page_title="Compare", page_icon="⚖️", layout="wide")
chat_store.init_db()

st.title("⚖️ Compare models")
st.caption(
    "Run the same prompt on two models side by side. Nothing here is saved to your "
    "chat history — it's a scratchpad for picking the right model."
)

if not ollama_alive():
    st.error("Cannot reach Ollama — start it or configure the endpoint on **Providers**.")
    st.stop()


@st.cache_data(ttl=60, show_spinner=False)
def _models():
    return list_models()


@st.cache_data(ttl=300, show_spinner=False)
def _provider_models(provider: str):
    try:
        return providers.list_provider_models(provider)
    except Exception as exc:
        logger.warning("model listing failed for {}: {}", provider, exc)
        return []


catalog = build_model_catalog(
    _models(), True, {p: _provider_models(p) for p in providers.configured_providers()}
)
if len(catalog) < 2:
    st.warning("Need at least two models to compare.")
    st.stop()

keys = ordered_keys(catalog, None)


def _label(k: str) -> str:
    sm = catalog[k]
    return f"{sm.badge} {sm.group} · {sm.name}"


col_a, col_b = st.columns(2)
with col_a:
    model_a = st.selectbox("Model A", keys, index=0, format_func=_label, key="cmp_a")
with col_b:
    model_b = st.selectbox("Model B", keys, index=min(1, len(keys) - 1),
                           format_func=_label, key="cmp_b")

system = st.text_input("System prompt (optional)", key="cmp_system",
                       placeholder="e.g. You are a concise expert. Answer in bullet points.")
prompt = st.chat_input("Ask both models…")

KEY_A, KEY_B = "compare::a", "compare::b"

if prompt:
    for key in (KEY_A, KEY_B):  # drop any previous round
        jobs.stop(key)
        jobs.clear(key)
    st.session_state.cmp_prompt = prompt
    sel_a, sel_b = catalog[model_a], catalog[model_b]
    jobs.run_ephemeral(KEY_A, sel_a.provider, sel_a.name, prompt, system, config.temperature)
    jobs.run_ephemeral(KEY_B, sel_b.provider, sel_b.name, prompt, system, config.temperature)
    st.rerun()


@st.fragment(run_every=0.6)
def render_compare() -> None:
    job_a, job_b = jobs.get(KEY_A), jobs.get(KEY_B)
    if not job_a and not job_b:
        return
    st.markdown(f"**Prompt:** {st.session_state.get('cmp_prompt', '')}")
    cols = st.columns(2)
    for col, job, name in ((cols[0], job_a, model_a), (cols[1], job_b, model_b)):
        with col:
            st.markdown(f"##### {_label(name)}")
            if job is None:
                st.caption("—")
                continue
            if job.status == "running":
                st.markdown((job.text or "_thinking…_") + " ▌")
            elif job.status == "error":
                st.error(job.error)
            else:
                st.markdown(job.text)
                if job.notes:
                    st.caption("⏱ " + job.notes[0])
    if (job_a and job_a.status == "running") or (job_b and job_b.status == "running"):
        if st.button("⏹ Stop both"):
            jobs.stop(KEY_A)
            jobs.stop(KEY_B)
            st.rerun(scope="app")


render_compare()
