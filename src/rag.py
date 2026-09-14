"""Vector retrieval over uploaded documents and past conversations (ChromaDB).

Only module that talks to ChromaDB. Must not decide *what* or *when* to
retrieve — that policy lives in orchestrator.py/jobs.py/memory.py, which
call the search_* functions here. Used by backend/app (workspace.py,
main.py) as well as by src/jobs.py, memory.py and orchestrator.py — check
both before changing a collection's schema or the similarity math below.
"""

from __future__ import annotations

import uuid
from typing import Any

import chromadb
from loguru import logger

from src.config import config
from src.ollama_client import embed_texts

# Importing this module opens/creates the on-disk Chroma store immediately
# (module-level singleton), the same import-time-I/O pattern as config.py.
_chroma = chromadb.PersistentClient(path=str(config.chroma_dir))

DOCS_COLLECTION = "doc_chunks"
HISTORY_COLLECTION = "chat_history"
MEMORY_COLLECTION = "memories"


def _collection(name: str) -> chromadb.Collection:
    # cosine space is what makes `1.0 - dist` in _flatten() below a valid
    # 0..1-ish similarity score, rather than an arbitrary distance unit.
    return _chroma.get_or_create_collection(name, metadata={"hnsw:space": "cosine"})


def _embed(embed_model: str, texts: list[str]) -> list[list[float]]:
    return embed_texts(embed_model, texts)


# --- uploaded documents -------------------------------------------------------

def index_doc_chunks(embed_model: str, conv_id: str, doc_name: str, chunks: list[str]) -> int:
    if not chunks:
        return 0
    col = _collection(DOCS_COLLECTION)
    embeddings = _embed(embed_model, chunks)
    col.add(
        ids=[uuid.uuid4().hex for _ in chunks],
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"conv_id": conv_id, "doc": doc_name} for _ in chunks],
    )
    logger.info("Indexed {} chunks from {} for conv {}", len(chunks), doc_name, conv_id)
    return len(chunks)


def search_docs(embed_model: str, conv_id: str, query: str, top_k: int) -> list[dict[str, Any]]:
    col = _collection(DOCS_COLLECTION)
    if col.count() == 0:
        return []
    res = col.query(
        query_embeddings=_embed(embed_model, [query]),
        n_results=top_k,
        where={"conv_id": conv_id},
    )
    return _flatten(res)


def conv_has_docs(conv_id: str) -> bool:
    col = _collection(DOCS_COLLECTION)
    return len(col.get(where={"conv_id": conv_id}, limit=1)["ids"]) > 0


# --- chat history (cross-conversation references) ------------------------------

def index_history_turn(
    embed_model: str, conv_id: str, conv_title: str, role: str, content: str
) -> None:
    if len(content.strip()) < 40:  # skip trivial turns
        return
    col = _collection(HISTORY_COLLECTION)
    # This 4000-char slice is Chroma's snippet/search copy only, not canonical
    # storage — chat_store.py's messages table holds the full, untruncated text.
    col.add(
        ids=[uuid.uuid4().hex],
        embeddings=_embed(embed_model, [content[:4000]]),
        documents=[content[:4000]],
        metadatas=[{"conv_id": conv_id, "title": conv_title, "role": role}],
    )


def search_history(
    embed_model: str, exclude_conv: str, query: str, top_k: int, min_similarity: float
) -> list[dict[str, Any]]:
    col = _collection(HISTORY_COLLECTION)
    if col.count() == 0:
        return []
    res = col.query(
        query_embeddings=_embed(embed_model, [query]),
        n_results=top_k * 3,  # over-fetch, then filter out the current conversation
        where={"conv_id": {"$ne": exclude_conv}},
    )
    hits = [h for h in _flatten(res) if h["similarity"] >= min_similarity]
    return hits[:top_k]


def delete_conv_vectors(conv_id: str) -> None:
    # Each collection is deleted independently so one failure doesn't block
    # cleanup of the other; a warning is logged but the caller is not told
    # cleanup was partial.
    for name in (DOCS_COLLECTION, HISTORY_COLLECTION):
        try:
            _collection(name).delete(where={"conv_id": conv_id})
        except Exception as exc:
            logger.warning("vector cleanup failed for {}: {}", conv_id, exc)


def clear_all_chat_vectors() -> None:
    """Drop all uploaded-document and chat-history vectors (memories are kept)."""
    for name in (DOCS_COLLECTION, HISTORY_COLLECTION):
        try:
            _chroma.delete_collection(name)
        except Exception as exc:
            logger.warning("collection drop failed for {}: {}", name, exc)


def clear_all_vectors() -> None:
    """Panic wipe: drop every collection, memories included."""
    for name in (DOCS_COLLECTION, HISTORY_COLLECTION, MEMORY_COLLECTION):
        try:
            _chroma.delete_collection(name)
        except Exception as exc:
            logger.warning("collection drop failed for {}: {}", name, exc)


def search_history_all(embed_model: str, query: str, top_k: int = 8) -> list[dict[str, Any]]:
    """Semantic search across ALL conversations (sidebar chat search)."""
    col = _collection(HISTORY_COLLECTION)
    if col.count() == 0:
        return []
    res = col.query(query_embeddings=_embed(embed_model, [query]), n_results=top_k)
    return _flatten(res)


# --- memories -------------------------------------------------------------------

def index_memory(embed_model: str, mem_id: str, content: str) -> None:
    _collection(MEMORY_COLLECTION).add(
        ids=[mem_id], embeddings=_embed(embed_model, [content]), documents=[content]
    )


def similar_memory(embed_model: str, content: str, threshold: float = 0.88) -> str | None:
    """Return the id of an existing near-duplicate memory, if any."""
    col = _collection(MEMORY_COLLECTION)
    if col.count() == 0:
        return None
    res = col.query(query_embeddings=_embed(embed_model, [content]), n_results=1)
    hits = _flatten(res)
    if hits and hits[0]["similarity"] >= threshold:
        return hits[0]["id"]
    return None


def search_memories(embed_model: str, query: str, top_k: int) -> list[dict[str, Any]]:
    col = _collection(MEMORY_COLLECTION)
    if col.count() == 0:
        return []
    res = col.query(query_embeddings=_embed(embed_model, [query]), n_results=top_k)
    return _flatten(res)


def delete_memory_vector(mem_id: str) -> None:
    try:
        _collection(MEMORY_COLLECTION).delete(ids=[mem_id])
    except Exception as exc:
        logger.warning("memory vector delete failed: {}", exc)


# --- helpers ----------------------------------------------------------------------

def _flatten(res: dict[str, Any]) -> list[dict[str, Any]]:
    """Chroma query result -> [{id, text, similarity, **metadata}], best first."""
    out = []
    ids = res.get("ids", [[]])[0]
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0] or [{}] * len(ids)
    dists = res.get("distances", [[]])[0] or [0.0] * len(ids)
    for id_, doc, meta, dist in zip(ids, docs, metas, dists):
        out.append({"id": id_, "text": doc, "similarity": 1.0 - dist, **(meta or {})})
    return out
