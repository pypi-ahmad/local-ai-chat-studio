"""Settings: generation, features, data export."""

import streamlit as st

from src import chat_store, memory
from src.config import config

st.set_page_config(page_title="Settings", page_icon="⚙️", layout="centered")
chat_store.init_db()

st.title("⚙️ Settings")

st.subheader("Generation")
st.slider(
    "Temperature", 0.0, 1.5,
    value=st.session_state.get("settings_temperature", config.temperature),
    step=0.05, key="settings_temperature",
)
st.text_area(
    "Custom system prompt (replaces the default)",
    value=st.session_state.get("settings_system_prompt", ""),
    key="settings_system_prompt",
    placeholder="Leave empty for the built-in assistant prompt.",
)

st.subheader("Features")
st.toggle(
    "Memory (extract & inject facts about you)",
    value=st.session_state.get("settings_memory", config.memory_enabled),
    key="settings_memory",
)
st.toggle(
    "Cross-chat references (recall past conversations)",
    value=st.session_state.get("settings_crosschat", config.cross_chat_references),
    key="settings_crosschat",
)
st.toggle(
    "Show cloud models (run remotely on ollama.com, not on disk)",
    value=st.session_state.get("settings_show_cloud", config.show_cloud_models),
    key="settings_show_cloud",
)

st.subheader("Maintenance")
col1, col2 = st.columns(2)
with col1:
    if st.button("Run memory decay now"):
        n = memory.run_decay()
        st.success(f"Archived {n} stale memories (unused > {config.memory_decay_days} days).")
with col2:
    st.download_button(
        "Export all chats (JSONL)",
        data=chat_store.export_jsonl(),
        file_name="chat_export.jsonl",
        mime="application/jsonl",
        help="One conversation per line — ready for future fine-tuning.",
    )

st.caption(
    f"Data lives in `{config.data_dir}` (SQLite + ChromaDB). "
    "Delete that folder to reset everything."
)
