"""Memory manager: view, edit, pin, delete what the assistant knows about you."""

import streamlit as st

from src import chat_store, rag
from src.personalization import get_profile, rebuild_profile

st.set_page_config(page_title="Memory", page_icon="🧠", layout="wide")
chat_store.init_db()

st.title("🧠 Memory")

profile = get_profile()
with st.expander("Your profile (auto-learned)", expanded=bool(profile)):
    if profile:
        st.markdown(profile)
    else:
        st.caption("No profile yet — it builds automatically as you chat.")
    helper = st.session_state.get("helper_model")
    if helper and st.button("Rebuild profile now"):
        with st.spinner("Rebuilding from recent chats and feedback..."):
            rebuild_profile(helper)
        st.rerun()

st.divider()

memories = chat_store.list_memories(active_only=False)
active = [m for m in memories if m["active"]]
archived = [m for m in memories if not m["active"]]

st.caption(f"{len(active)} active · {len(archived)} archived")

if not memories:
    st.info("Nothing remembered yet. Memories are extracted automatically as you chat.")

for m in active:
    c1, c2, c3, c4 = st.columns([8, 1, 1, 1])
    with c1:
        new_content = st.text_input(
            "memory",
            value=m["content"],
            key=f"mem_{m['id']}",
            label_visibility="collapsed",
        )
        if new_content != m["content"]:
            chat_store.update_memory(m["id"], content=new_content)
        st.caption(f"{m['category']} · used {m['use_count']}×")
    with c2:
        if st.button("📌" if not m["pinned"] else "📍", key=f"pin_{m['id']}",
                     help="Pin (always injected)" if not m["pinned"] else "Unpin"):
            chat_store.update_memory(m["id"], pinned=0 if m["pinned"] else 1)
            st.rerun()
    with c3:
        if st.button("📦", key=f"arch_{m['id']}", help="Archive"):
            chat_store.update_memory(m["id"], active=0)
            st.rerun()
    with c4:
        if st.button("🗑", key=f"delmem_{m['id']}", help="Delete forever"):
            chat_store.delete_memory(m["id"])
            rag.delete_memory_vector(m["id"])
            st.rerun()

if archived:
    with st.expander(f"Archived ({len(archived)})"):
        for m in archived:
            c1, c2 = st.columns([10, 1])
            c1.markdown(f"~~{m['content']}~~")
            if c2.button("♻️", key=f"restore_{m['id']}", help="Restore"):
                chat_store.update_memory(m["id"], active=1)
                st.rerun()
