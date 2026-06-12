"""SQLite persistence: conversations, messages, memories, feedback, profile."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from src.config import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    memory_extracted_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conv_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments_json TEXT,
    ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, ts);
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'fact',
    source_conv TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS feedback (
    message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,  -- 1 thumbs-up, -1 thumbs-down
    ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(config.db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with _conn() as conn:
        conn.executescript(_SCHEMA)


# --- conversations -----------------------------------------------------------

def create_conversation(model: str) -> str:
    conv_id = uuid.uuid4().hex
    now = _now()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (?,?,?,?,?)",
            (conv_id, "New chat", model, now, now),
        )
    return conv_id


def list_conversations(limit: int = 100) -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_conversation(conv_id: str) -> dict[str, Any] | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id=?", (conv_id,)).fetchone()
    return dict(row) if row else None


def rename_conversation(conv_id: str, title: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE conversations SET title=?, updated_at=? WHERE id=?", (title, _now(), conv_id)
        )


def delete_conversation(conv_id: str) -> None:
    with _conn() as conn:
        conn.execute("DELETE FROM conversations WHERE id=?", (conv_id,))


def mark_memory_extracted(conv_id: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE conversations SET memory_extracted_at=? WHERE id=?", (_now(), conv_id)
        )


# --- messages ----------------------------------------------------------------

def add_message(
    conv_id: str, role: str, content: str, attachments: list[dict[str, Any]] | None = None
) -> str:
    msg_id = uuid.uuid4().hex
    now = _now()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO messages (id, conv_id, role, content, attachments_json, ts) VALUES (?,?,?,?,?,?)",
            (msg_id, conv_id, role, content, json.dumps(attachments) if attachments else None, now),
        )
        conn.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, conv_id))
    return msg_id


def get_messages(conv_id: str) -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE conv_id=? ORDER BY ts", (conv_id,)
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["attachments"] = json.loads(d["attachments_json"]) if d["attachments_json"] else []
        out.append(d)
    return out


def message_count(conv_id: str) -> int:
    with _conn() as conn:
        (n,) = conn.execute("SELECT COUNT(*) FROM messages WHERE conv_id=?", (conv_id,)).fetchone()
    return n


# --- memories ----------------------------------------------------------------

def add_memory(content: str, category: str, source_conv: str | None) -> str:
    mem_id = uuid.uuid4().hex
    now = _now()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO memories (id, content, category, source_conv, created_at, last_used_at) "
            "VALUES (?,?,?,?,?,?)",
            (mem_id, content, category, source_conv, now, now),
        )
    return mem_id


def list_memories(active_only: bool = True) -> list[dict[str, Any]]:
    q = "SELECT * FROM memories"
    if active_only:
        q += " WHERE active=1"
    q += " ORDER BY pinned DESC, last_used_at DESC"
    with _conn() as conn:
        return [dict(r) for r in conn.execute(q).fetchall()]


def touch_memories(mem_ids: list[str]) -> None:
    if not mem_ids:
        return
    now = _now()
    with _conn() as conn:
        conn.executemany(
            "UPDATE memories SET last_used_at=?, use_count=use_count+1 WHERE id=?",
            [(now, mid) for mid in mem_ids],
        )


def update_memory(mem_id: str, **fields: Any) -> None:
    allowed = {"content", "category", "pinned", "active"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return
    clause = ", ".join(f"{k}=?" for k in sets)
    with _conn() as conn:
        conn.execute(f"UPDATE memories SET {clause} WHERE id=?", (*sets.values(), mem_id))


def delete_memory(mem_id: str) -> None:
    with _conn() as conn:
        conn.execute("DELETE FROM memories WHERE id=?", (mem_id,))


def decay_memories(max_age_days: int) -> int:
    """Archive unpinned memories not used within ``max_age_days``. Returns count."""
    with _conn() as conn:
        cur = conn.execute(
            "UPDATE memories SET active=0 WHERE pinned=0 AND active=1 "
            "AND julianday('now') - julianday(last_used_at) > ?",
            (max_age_days,),
        )
    return cur.rowcount


# --- feedback ----------------------------------------------------------------

def set_feedback(message_id: str, rating: int) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO feedback (message_id, rating, ts) VALUES (?,?,?) "
            "ON CONFLICT(message_id) DO UPDATE SET rating=excluded.rating, ts=excluded.ts",
            (message_id, rating, _now()),
        )


def get_feedback(conv_id: str) -> dict[str, int]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT f.message_id, f.rating FROM feedback f "
            "JOIN messages m ON m.id = f.message_id WHERE m.conv_id=?",
            (conv_id,),
        ).fetchall()
    return {r["message_id"]: r["rating"] for r in rows}


def recent_feedback_samples(limit: int = 30) -> list[dict[str, Any]]:
    """Recent rated assistant messages, for profile building."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT m.content, f.rating FROM feedback f "
            "JOIN messages m ON m.id = f.message_id ORDER BY f.ts DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


# --- kv (user profile, counters) ----------------------------------------------

def kv_get(key: str, default: str | None = None) -> str | None:
    with _conn() as conn:
        row = conn.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def kv_set(key: str, value: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO kv (key, value, updated_at) VALUES (?,?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, value, _now()),
        )


# --- export --------------------------------------------------------------------

def export_jsonl() -> str:
    """All conversations as JSONL (one conversation per line) for future fine-tuning."""
    lines = []
    for conv in list_conversations(limit=100_000):
        msgs = [
            {"role": m["role"], "content": m["content"]} for m in get_messages(conv["id"])
        ]
        lines.append(
            json.dumps(
                {"id": conv["id"], "title": conv["title"], "model": conv["model"], "messages": msgs},
                ensure_ascii=False,
            )
        )
    return "\n".join(lines)
