"""Settings: generation, features, data export."""

import streamlit as st

from src import chat_store, memory, providers, rag
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
col1, col2, col3 = st.columns(3)
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
with col3:
    if st.button("🗑 Clear all chats", help="Delete every conversation (memories are kept)."):
        st.session_state.confirm_clear_chats = True

if st.session_state.get("confirm_clear_chats"):
    st.warning(
        "This permanently deletes **all conversations and their messages**. "
        "Your long-term memories and profile are kept. Export first if unsure."
    )
    cc1, cc2 = st.columns(2)
    with cc1:
        if st.button("Yes, delete all chats", type="primary"):
            n = chat_store.clear_all_conversations()
            rag.clear_all_chat_vectors()
            st.session_state.conv_id = None  # shared across pages
            st.session_state.confirm_clear_chats = False
            st.success(f"Cleared {n} conversation(s).")
    with cc2:
        if st.button("Cancel"):
            st.session_state.confirm_clear_chats = False
            st.rerun()

st.subheader("Assistants (presets)")
st.caption(
    "An assistant bundles a system prompt + model + temperature. Pick it from the "
    "sidebar on the chat page. The 🧑‍💻 Coding Agent is built in."
)
for p in chat_store.list_presets():
    pc1, pc2 = st.columns([5, 1])
    with pc1:
        st.markdown(
            f"**{p['name']}** — `{p['model_key']}` · temp {p['temperature']}"
            + (" · built-in" if p["builtin"] else "")
        )
    with pc2:
        if st.button("🗑", key=f"delp_{p['id']}", help="Delete preset"):
            chat_store.delete_preset(p["id"])
            st.rerun()

with st.form("new_preset"):
    st.markdown("**Create an assistant from the current chat settings**")
    preset_name = st.text_input("Name", placeholder="e.g. SQL Tutor")
    preset_prompt = st.text_area(
        "System prompt",
        value=st.session_state.get("settings_system_prompt", ""),
        placeholder="You are…",
    )
    preset_temp = st.slider("Temperature", 0.0, 1.5,
                            value=float(st.session_state.get("settings_temperature", config.temperature)),
                            step=0.05)
    if st.form_submit_button("Save assistant"):
        model_key = st.session_state.get("selected_model", "")
        if preset_name.strip() and model_key:
            chat_store.save_preset(preset_name.strip(), preset_prompt, model_key, preset_temp)
            st.success(f"Saved “{preset_name.strip()}” (model: {model_key}).")
            st.rerun()
        else:
            st.error("Give it a name, and pick a model on the chat page first.")

st.subheader("Data controls")
imp = st.file_uploader("Import chats (JSONL export from this app)", type=["jsonl", "json"])
if imp is not None and st.button("Import now"):
    n = chat_store.import_jsonl(imp.getvalue().decode("utf-8", errors="replace"))
    st.success(f"Imported {n} conversation(s).")

if st.button("🧨 Panic wipe — erase EVERYTHING"):
    st.session_state.confirm_wipe = True
if st.session_state.get("confirm_wipe"):
    st.error(
        "This erases **all chats, memories, your profile, presets, vectors, and "
        "in-memory API keys**. There is no undo. Export first if unsure."
    )
    wc1, wc2 = st.columns(2)
    with wc1:
        if st.button("Yes, erase everything", type="primary"):
            chat_store.wipe_everything()
            rag.clear_all_vectors()
            providers.clear_all_secrets()
            st.session_state.conv_id = None
            st.session_state.confirm_wipe = False
            st.success("Everything wiped. Fresh start.")
    with wc2:
        if st.button("Cancel wipe"):
            st.session_state.confirm_wipe = False
            st.rerun()

st.caption(
    f"Data lives in `{config.data_dir}` (SQLite + ChromaDB). "
    "Delete that folder to reset everything."
)
