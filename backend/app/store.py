from __future__ import annotations

import base64
import json
import re
import sqlite3
import threading
import uuid
from pathlib import Path
from typing import Any

from backend.app.contracts import (
    Backpack,
    BackpackCreate,
    BackpackItem,
    Conversation,
    FocusCreate,
    FocusSession,
    Memory,
    Message,
    Preset,
    PresetCreate,
    ProviderPolicy,
    RunEvent,
    RunSnapshot,
    Upload,
    utc_now,
)


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    model TEXT NOT NULL DEFAULT 'unknown',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    memory_extracted_at TEXT,
    pinned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conv_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments_json TEXT,
    metadata_json TEXT,
    run_id TEXT,
    ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, ts);
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    conversation_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT NOT NULL DEFAULT '',
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    request_json TEXT NOT NULL DEFAULT '{}',
    context_json TEXT,
    metrics_json TEXT NOT NULL DEFAULT '{}',
    receipt_hash TEXT
);
CREATE TABLE IF NOT EXISTS run_events (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    type TEXT NOT NULL,
    data_json TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    PRIMARY KEY (run_id, position)
);
CREATE TABLE IF NOT EXISTS provider_policies (
    provider TEXT PRIMARY KEY,
    policy_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backpacks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backpack_items (
    id TEXT PRIMARY KEY,
    backpack_id TEXT NOT NULL REFERENCES backpacks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    success_criteria TEXT NOT NULL,
    constraints_json TEXT NOT NULL DEFAULT '[]',
    turn_limit INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'fact',
    source_conv TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    quarantine_reason TEXT,
    source_message_ids_json TEXT NOT NULL DEFAULT '[]',
    selection_reason TEXT,
    extractor_provider TEXT,
    extractor_model TEXT
);
CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    system_prompt TEXT NOT NULL DEFAULT '',
    model_key TEXT NOT NULL DEFAULT '',
    temperature REAL NOT NULL DEFAULT 0.7,
    builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
    message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    kind TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL,
    text_content TEXT NOT NULL DEFAULT '',
    content_blob BLOB,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);
"""


class Store:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        if database_url != ":memory:":
            Path(database_url).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(database_url, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.connection:
            self.connection.executescript(SCHEMA)
            self._ensure_column(
                "conversations", "model", "TEXT NOT NULL DEFAULT 'unknown'"
            )
            self._ensure_column("conversations", "pinned", "INTEGER NOT NULL DEFAULT 0")
            self._ensure_column("conversations", "memory_extracted_at", "TEXT")
            self._ensure_column("messages", "attachments_json", "TEXT")
            self._ensure_column("messages", "metadata_json", "TEXT")
            self._ensure_column("messages", "run_id", "TEXT")
            self._ensure_column("memories", "status", "TEXT NOT NULL DEFAULT 'active'")
            self._ensure_column("memories", "quarantine_reason", "TEXT")
            self._ensure_column(
                "memories", "source_message_ids_json", "TEXT NOT NULL DEFAULT '[]'"
            )
            self._ensure_column("memories", "selection_reason", "TEXT")
            self._ensure_column("memories", "extractor_provider", "TEXT")
            self._ensure_column("memories", "extractor_model", "TEXT")
            self._ensure_column("presets", "builtin", "INTEGER NOT NULL DEFAULT 0")
            self._ensure_column(
                "presets", "created_at", "TEXT NOT NULL DEFAULT ''"
            )

    def _ensure_column(self, table: str, column: str, definition: str) -> None:
        columns = {
            row["name"]
            for row in self.connection.execute(f"PRAGMA table_info({table})")
        }
        if column not in columns:
            self.connection.execute(
                f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
            )

    def create_conversation(self, title: str, model: str = "unknown") -> Conversation:
        conversation_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO conversations (id, title, model, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (conversation_id, title, model, now, now),
            )
        return self.get_conversation(conversation_id)

    def list_conversations(self, query: str = "") -> list[Conversation]:
        with self.lock:
            if query:
                like = f"%{query}%"
                rows = self.connection.execute(
                    "SELECT DISTINCT c.* FROM conversations c "
                    "LEFT JOIN messages m ON m.conv_id = c.id "
                    "WHERE c.title LIKE ? OR m.content LIKE ? "
                    "ORDER BY c.pinned DESC, c.updated_at DESC",
                    (like, like),
                ).fetchall()
            else:
                rows = self.connection.execute(
                    "SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC"
                ).fetchall()
        return [self._conversation(row, []) for row in rows]

    def search_related_messages(
        self, query: str, exclude_conversation_id: str, limit: int = 5
    ) -> list[dict[str, Any]]:
        terms = {
            term for term in re.findall(r"[a-z0-9]+", query.lower()) if len(term) > 2
        }
        if not terms:
            return []
        with self.lock:
            rows = self.connection.execute(
                "SELECT m.id, m.conv_id, m.role, m.content, c.title "
                "FROM messages m JOIN conversations c ON c.id = m.conv_id "
                "WHERE m.conv_id != ? ORDER BY m.ts DESC LIMIT 1000",
                (exclude_conversation_id,),
            ).fetchall()
        matches = []
        for row in rows:
            candidate_terms = set(re.findall(r"[a-z0-9]+", row["content"].lower()))
            score = len(terms & candidate_terms) / len(terms)
            if score:
                matches.append({**dict(row), "score": score})
        matches.sort(key=lambda item: item["score"], reverse=True)
        return matches[:limit]

    def get_conversation(self, conversation_id: str) -> Conversation:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
            ).fetchone()
            if row is None:
                raise KeyError(conversation_id)
            messages = self.connection.execute(
                "SELECT * FROM messages WHERE conv_id = ? ORDER BY ts, rowid",
                (conversation_id,),
            ).fetchall()
        return self._conversation(row, self._messages(messages))

    def update_conversation(
        self,
        conversation_id: str,
        *,
        title: str | None = None,
        pinned: bool | None = None,
    ) -> Conversation:
        self.get_conversation(conversation_id)
        fields: list[str] = []
        values: list[Any] = []
        if title is not None:
            fields.append("title = ?")
            values.append(title)
        if pinned is not None:
            fields.append("pinned = ?")
            values.append(int(pinned))
        if fields:
            fields.append("updated_at = ?")
            values.extend([utc_now(), conversation_id])
            with self.lock, self.connection:
                self.connection.execute(
                    f"UPDATE conversations SET {', '.join(fields)} WHERE id = ?", values
                )
        return self.get_conversation(conversation_id)

    def delete_conversation(self, conversation_id: str) -> None:
        with self.lock, self.connection:
            cursor = self.connection.execute(
                "DELETE FROM conversations WHERE id = ?", (conversation_id,)
            )
        if cursor.rowcount == 0:
            raise KeyError(conversation_id)

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        *,
        run_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Message:
        self.get_conversation(conversation_id)
        message_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO messages "
                "(id, conv_id, role, content, metadata_json, run_id, ts) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    message_id,
                    conversation_id,
                    role,
                    content,
                    json.dumps(metadata or {}),
                    run_id,
                    now,
                ),
            )
            self.connection.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
            position = self.connection.execute(
                "SELECT COUNT(*) - 1 FROM messages WHERE conv_id = ?",
                (conversation_id,),
            ).fetchone()[0]
        return Message(
            id=message_id,
            position=position,
            role=role,
            content=content,
            created_at=now,
            run_id=run_id,
            metadata=metadata or {},
        )

    def branch_conversation(
        self, conversation_id: str, message_id: str, title: str
    ) -> Conversation:
        source = self.get_conversation(conversation_id)
        target = self.create_conversation(title, source.model)
        found = False
        for message in source.messages:
            self.add_message(
                target.id, message.role, message.content, metadata=message.metadata
            )
            if message.id == message_id:
                found = True
                break
        if not found:
            self.delete_conversation(target.id)
            raise KeyError(message_id)
        return self.get_conversation(target.id)

    def create_run(
        self,
        snapshot: RunSnapshot,
        session_id: str,
        request: dict[str, Any],
        context: dict[str, Any] | None,
    ) -> None:
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO runs "
                "(id, session_id, conversation_id, provider, model, status, output, error, "
                "created_at, started_at, completed_at, request_json, context_json, metrics_json, receipt_hash) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    snapshot.id,
                    session_id,
                    snapshot.conversation_id,
                    snapshot.provider,
                    snapshot.model,
                    snapshot.status,
                    snapshot.output,
                    snapshot.error,
                    snapshot.created_at,
                    snapshot.started_at,
                    snapshot.completed_at,
                    json.dumps(request),
                    json.dumps(context) if context else None,
                    json.dumps(snapshot.metrics),
                    snapshot.receipt_hash,
                ),
            )

    def update_run(self, snapshot: RunSnapshot) -> None:
        with self.lock, self.connection:
            self.connection.execute(
                "UPDATE runs SET status = ?, output = ?, error = ?, started_at = ?, "
                "completed_at = ?, metrics_json = ?, receipt_hash = ? WHERE id = ?",
                (
                    snapshot.status,
                    snapshot.output,
                    snapshot.error,
                    snapshot.started_at,
                    snapshot.completed_at,
                    json.dumps(snapshot.metrics),
                    snapshot.receipt_hash,
                    snapshot.id,
                ),
            )

    def add_run_event(self, event: RunEvent) -> None:
        with self.lock, self.connection:
            position = self.connection.execute(
                "SELECT COUNT(*) FROM run_events WHERE run_id = ?", (event.run_id,)
            ).fetchone()[0]
            self.connection.execute(
                "INSERT INTO run_events VALUES (?, ?, ?, ?, ?)",
                (
                    event.run_id,
                    position,
                    event.type,
                    json.dumps(event.data),
                    event.timestamp,
                ),
            )

    def get_run_record(self, run_id: str, session_id: str) -> sqlite3.Row:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM runs WHERE id = ? AND session_id = ?",
                (run_id, session_id),
            ).fetchone()
        if row is None:
            raise KeyError(run_id)
        return row

    def latest_receipt_hash(self) -> str:
        with self.lock:
            row = self.connection.execute(
                "SELECT receipt_hash FROM runs WHERE receipt_hash IS NOT NULL "
                "ORDER BY completed_at DESC LIMIT 1"
            ).fetchone()
        return row[0] if row else ""

    def run_bundle(self, run_id: str, session_id: str) -> dict[str, Any]:
        row = self.get_run_record(run_id, session_id)
        return {
            "snapshot": self._snapshot(row),
            "request": json.loads(row["request_json"]),
            "context": json.loads(row["context_json"]) if row["context_json"] else None,
        }

    def list_runs(self, session_id: str) -> list[RunSnapshot]:
        with self.lock:
            rows = self.connection.execute(
                "SELECT * FROM runs WHERE session_id = ? ORDER BY created_at DESC",
                (session_id,),
            ).fetchall()
        return [self._snapshot(row) for row in rows]

    def get_policy(self, provider: str) -> ProviderPolicy:
        with self.lock:
            row = self.connection.execute(
                "SELECT policy_json FROM provider_policies WHERE provider = ?",
                (provider,),
            ).fetchone()
        return ProviderPolicy(**json.loads(row[0])) if row else ProviderPolicy()

    def set_policy(self, provider: str, policy: ProviderPolicy) -> ProviderPolicy:
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO provider_policies VALUES (?, ?, ?) "
                "ON CONFLICT(provider) DO UPDATE SET policy_json = excluded.policy_json, "
                "updated_at = excluded.updated_at",
                (provider, policy.model_dump_json(), utc_now()),
            )
        return policy

    def create_backpack(self, payload: BackpackCreate) -> Backpack:
        backpack_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO backpacks VALUES (?, ?, ?, ?)",
                (backpack_id, payload.name, now, now),
            )
            for position, item in enumerate(payload.items):
                self.connection.execute(
                    "INSERT INTO backpack_items VALUES (?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        backpack_id,
                        position,
                        item.title,
                        item.content,
                    ),
                )
        return self.get_backpack(backpack_id)

    def get_backpack(self, backpack_id: str) -> Backpack:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM backpacks WHERE id = ?", (backpack_id,)
            ).fetchone()
            if row is None:
                raise KeyError(backpack_id)
            items = self.connection.execute(
                "SELECT * FROM backpack_items WHERE backpack_id = ? ORDER BY position",
                (backpack_id,),
            ).fetchall()
        return Backpack(
            **dict(row),
            items=[
                BackpackItem(
                    id=item["id"], title=item["title"], content=item["content"]
                )
                for item in items
            ],
        )

    def list_backpacks(self) -> list[Backpack]:
        with self.lock:
            ids = [
                row[0]
                for row in self.connection.execute(
                    "SELECT id FROM backpacks ORDER BY updated_at DESC"
                )
            ]
        return [self.get_backpack(item) for item in ids]

    def update_backpack(self, backpack_id: str, payload: BackpackCreate) -> Backpack:
        self.get_backpack(backpack_id)
        with self.lock, self.connection:
            self.connection.execute(
                "UPDATE backpacks SET name = ?, updated_at = ? WHERE id = ?",
                (payload.name, utc_now(), backpack_id),
            )
            self.connection.execute(
                "DELETE FROM backpack_items WHERE backpack_id = ?", (backpack_id,)
            )
            for position, item in enumerate(payload.items):
                self.connection.execute(
                    "INSERT INTO backpack_items VALUES (?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        backpack_id,
                        position,
                        item.title,
                        item.content,
                    ),
                )
        return self.get_backpack(backpack_id)

    def delete_backpack(self, backpack_id: str) -> None:
        with self.lock, self.connection:
            cursor = self.connection.execute(
                "DELETE FROM backpacks WHERE id = ?", (backpack_id,)
            )
        if cursor.rowcount == 0:
            raise KeyError(backpack_id)

    def create_focus(self, payload: FocusCreate) -> FocusSession:
        self.get_conversation(payload.conversation_id)
        focus_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO focus_sessions "
                "(id, conversation_id, objective, success_criteria, constraints_json, turn_limit, status, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, 'active', ?)",
                (
                    focus_id,
                    payload.conversation_id,
                    payload.objective,
                    payload.success_criteria,
                    json.dumps(payload.constraints),
                    payload.turn_limit,
                    now,
                ),
            )
        return FocusSession(
            id=focus_id, status="active", created_at=now, **payload.model_dump()
        )

    def active_focus(self, conversation_id: str) -> FocusSession | None:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM focus_sessions WHERE conversation_id = ? AND status = 'active' "
                "ORDER BY created_at DESC LIMIT 1",
                (conversation_id,),
            ).fetchone()
        if row is None:
            return None
        return FocusSession(
            id=row["id"],
            conversation_id=row["conversation_id"],
            objective=row["objective"],
            success_criteria=row["success_criteria"],
            constraints=json.loads(row["constraints_json"]),
            turn_limit=row["turn_limit"],
            status=row["status"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
        )

    def get_focus(self, focus_id: str) -> FocusSession:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM focus_sessions WHERE id = ?", (focus_id,)
            ).fetchone()
        if row is None:
            raise KeyError(focus_id)
        return FocusSession(
            id=row["id"],
            conversation_id=row["conversation_id"],
            objective=row["objective"],
            success_criteria=row["success_criteria"],
            constraints=json.loads(row["constraints_json"]),
            turn_limit=row["turn_limit"],
            status=row["status"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
        )

    def list_focus(self, conversation_id: str | None = None) -> list[FocusSession]:
        with self.lock:
            if conversation_id:
                rows = self.connection.execute(
                    "SELECT id FROM focus_sessions WHERE conversation_id = ? "
                    "ORDER BY created_at DESC",
                    (conversation_id,),
                ).fetchall()
            else:
                rows = self.connection.execute(
                    "SELECT id FROM focus_sessions ORDER BY created_at DESC"
                ).fetchall()
        return [self.get_focus(row["id"]) for row in rows]

    def update_focus(self, focus_id: str, status: str) -> FocusSession:
        self.get_focus(focus_id)
        with self.lock, self.connection:
            self.connection.execute(
                "UPDATE focus_sessions SET status = ?, completed_at = ? WHERE id = ?",
                (status, utc_now(), focus_id),
            )
        return self.get_focus(focus_id)

    def create_memory(
        self,
        content: str,
        category: str,
        source_conversation_id: str | None,
        *,
        status: str = "active",
        quarantine_reason: str | None = None,
        source_message_ids: list[str] | None = None,
        selection_reason: str | None = None,
        extractor_provider: str | None = None,
        extractor_model: str | None = None,
    ) -> Memory:
        memory_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO memories "
                "(id, content, category, source_conv, created_at, last_used_at, status, "
                "quarantine_reason, source_message_ids_json, selection_reason, "
                "extractor_provider, extractor_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    memory_id,
                    content,
                    category,
                    source_conversation_id,
                    now,
                    now,
                    status,
                    quarantine_reason,
                    json.dumps(source_message_ids or []),
                    selection_reason,
                    extractor_provider,
                    extractor_model,
                ),
            )
        return self.get_memory(memory_id)

    def get_memory(self, memory_id: str) -> Memory:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM memories WHERE id = ?", (memory_id,)
            ).fetchone()
        if row is None:
            raise KeyError(memory_id)
        status = row["status"]
        if not row["active"] and status == "active":
            status = "archived"
        return Memory(
            id=row["id"],
            content=row["content"],
            category=row["category"],
            source_conversation_id=row["source_conv"],
            created_at=row["created_at"],
            last_used_at=row["last_used_at"],
            use_count=row["use_count"],
            pinned=bool(row["pinned"]),
            status=status,
            quarantine_reason=row["quarantine_reason"],
            source_message_ids=json.loads(row["source_message_ids_json"] or "[]"),
            selection_reason=row["selection_reason"],
            extractor_provider=row["extractor_provider"],
            extractor_model=row["extractor_model"],
        )

    def create_memories_batch(
        self,
        conversation_id: str,
        candidates: list[dict[str, Any]],
        provider: str,
        model: str,
    ) -> list[Memory]:
        self.get_conversation(conversation_id)
        ids: list[str] = []
        now = utc_now()
        with self.lock, self.connection:
            for candidate in candidates:
                memory_id = str(uuid.uuid4())
                ids.append(memory_id)
                self.connection.execute(
                    "INSERT INTO memories "
                    "(id, content, category, source_conv, created_at, last_used_at, status, "
                    "quarantine_reason, source_message_ids_json, selection_reason, "
                    "extractor_provider, extractor_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        memory_id,
                        candidate["content"],
                        candidate["category"],
                        conversation_id,
                        now,
                        now,
                        candidate["status"],
                        candidate.get("quarantine_reason"),
                        json.dumps(candidate.get("source_message_ids", [])),
                        candidate.get("selection_reason"),
                        provider,
                        model,
                    ),
                )
            self.connection.execute(
                "UPDATE conversations SET memory_extracted_at = ? WHERE id = ?",
                (now, conversation_id),
            )
        return [self.get_memory(memory_id) for memory_id in ids]

    def list_memories(self) -> list[Memory]:
        with self.lock:
            ids = [
                row[0]
                for row in self.connection.execute(
                    "SELECT id FROM memories ORDER BY pinned DESC, last_used_at DESC"
                )
            ]
        return [self.get_memory(item) for item in ids]

    def update_memory(
        self,
        memory_id: str,
        *,
        content: str | None = None,
        category: str | None = None,
        status: str | None = None,
        pinned: bool | None = None,
    ) -> Memory:
        self.get_memory(memory_id)
        fields: list[str] = []
        values: list[Any] = []
        if content is not None:
            fields.append("content = ?")
            values.append(content)
        if category is not None:
            fields.append("category = ?")
            values.append(category)
        if status is not None:
            fields.extend(["status = ?", "active = ?"])
            values.extend([status, int(status == "active")])
            if status == "active":
                fields.append("quarantine_reason = NULL")
        if pinned is not None:
            fields.append("pinned = ?")
            values.append(int(pinned))
        if fields:
            values.append(memory_id)
            with self.lock, self.connection:
                self.connection.execute(
                    f"UPDATE memories SET {', '.join(fields)} WHERE id = ?", values
                )
        return self.get_memory(memory_id)

    def delete_memory(self, memory_id: str) -> None:
        with self.lock, self.connection:
            cursor = self.connection.execute(
                "DELETE FROM memories WHERE id = ?", (memory_id,)
            )
        if cursor.rowcount == 0:
            raise KeyError(memory_id)

    def create_preset(self, payload: PresetCreate) -> Preset:
        preset_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO presets "
                "(id, name, system_prompt, model_key, temperature, builtin, created_at) "
                "VALUES (?, ?, ?, ?, ?, 0, ?)",
                (
                    preset_id,
                    payload.name,
                    payload.system_prompt,
                    payload.model_key,
                    payload.temperature,
                    now,
                ),
            )
        return Preset(id=preset_id, **payload.model_dump())

    def list_presets(self) -> list[Preset]:
        with self.lock:
            rows = self.connection.execute(
                "SELECT id, name, system_prompt, model_key, temperature "
                "FROM presets ORDER BY builtin DESC, name"
            ).fetchall()
        return [Preset(**dict(row)) for row in rows]

    def delete_preset(self, preset_id: str) -> None:
        with self.lock, self.connection:
            cursor = self.connection.execute(
                "DELETE FROM presets WHERE id = ?", (preset_id,)
            )
        if cursor.rowcount == 0:
            raise KeyError(preset_id)

    def set_feedback(self, message_id: str, rating: int) -> None:
        with self.lock, self.connection:
            exists = self.connection.execute(
                "SELECT 1 FROM messages WHERE id = ?", (message_id,)
            ).fetchone()
            if exists is None:
                raise KeyError(message_id)
            self.connection.execute(
                "INSERT INTO feedback (message_id, rating, ts) VALUES (?, ?, ?) "
                "ON CONFLICT(message_id) DO UPDATE SET rating = excluded.rating, ts = excluded.ts",
                (message_id, rating, utc_now()),
            )

    def get_feedback(self, conversation_id: str) -> dict[str, int]:
        self.get_conversation(conversation_id)
        with self.lock:
            rows = self.connection.execute(
                "SELECT f.message_id, f.rating FROM feedback f "
                "JOIN messages m ON m.id = f.message_id WHERE m.conv_id = ?",
                (conversation_id,),
            ).fetchall()
        return {row["message_id"]: row["rating"] for row in rows}

    def export_conversation_markdown(self, conversation_id: str) -> str:
        conversation = self.get_conversation(conversation_id)
        lines = [f"# {conversation.title}", f"_model: {conversation.model}_", ""]
        for message in conversation.messages:
            who = "**You**" if message.role == "user" else "**Assistant**"
            lines.extend([f"{who}:", "", message.content, "", "---", ""])
        return "\n".join(lines)

    def export_jsonl(self) -> str:
        lines = []
        for conversation in self.list_conversations():
            full = self.get_conversation(conversation.id)
            lines.append(
                json.dumps(
                    {
                        "id": full.id,
                        "title": full.title,
                        "model": full.model,
                        "messages": [
                            {"role": message.role, "content": message.content}
                            for message in full.messages
                            if message.role in {"user", "assistant"}
                        ],
                    },
                    ensure_ascii=False,
                )
            )
        return "\n".join(lines)

    def import_jsonl(self, data: str) -> int:
        imported = 0
        for line in data.splitlines():
            try:
                value = json.loads(line)
                messages = value.get("messages", [])
                if not isinstance(value, dict) or not isinstance(messages, list):
                    continue
                conversation = self.create_conversation(
                    str(value.get("title") or "Imported chat"),
                    str(value.get("model") or "unknown"),
                )
                for message in messages:
                    if (
                        isinstance(message, dict)
                        and message.get("role") in {"user", "assistant"}
                        and isinstance(message.get("content"), str)
                        and message["content"]
                    ):
                        self.add_message(
                            conversation.id, message["role"], message["content"]
                        )
                imported += 1
            except (json.JSONDecodeError, AttributeError, TypeError):
                continue
        return imported

    def wipe(self) -> None:
        with self.lock, self.connection:
            for table in (
                "run_events",
                "runs",
                "backpack_items",
                "backpacks",
                "conversations",
                "memories",
                "kv",
                "presets",
                "provider_policies",
            ):
                self.connection.execute(f"DELETE FROM {table}")

    def get_profile(self) -> str:
        with self.lock:
            row = self.connection.execute(
                "SELECT value FROM kv WHERE key = 'user_profile'"
            ).fetchone()
        return row["value"] if row else ""

    def set_profile(self, content: str) -> str:
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO kv (key, value, updated_at) VALUES ('user_profile', ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value, "
                "updated_at = excluded.updated_at",
                (content, utc_now()),
            )
        return content

    def import_v2_database(self, source_path: str) -> int:
        migration_version = 2001
        with self.lock:
            applied = self.connection.execute(
                "SELECT 1 FROM schema_migrations WHERE version = ?",
                (migration_version,),
            ).fetchone()
        if applied:
            return 0
        source = Path(source_path)
        if not source.is_file():
            raise FileNotFoundError(source)
        if self.database_url != ":memory:":
            target = Path(self.database_url)
            backup = target.with_name(
                f"{target.name}.pre-v2-import-{uuid.uuid4().hex[:8]}.bak"
            )
            with sqlite3.connect(backup) as backup_connection, self.lock:
                self.connection.backup(backup_connection)
        imported = 0
        previous = sqlite3.connect(source)
        previous.row_factory = sqlite3.Row
        try:
            tables = {
                row[0]
                for row in previous.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                )
            }
            if "conversations" not in tables or "messages" not in tables:
                raise ValueError("The v2 database has no conversation schema")
            table_order = (
                "conversations",
                "messages",
                "memories",
                "presets",
                "provider_policies",
                "backpacks",
                "backpack_items",
                "focus_sessions",
                "uploads",
                "runs",
                "run_events",
            )
            with self.lock, self.connection:
                for table in table_order:
                    if table not in tables:
                        continue
                    source_columns = [
                        row[1]
                        for row in previous.execute(f"PRAGMA table_info({table})")
                    ]
                    target_columns = {
                        row["name"]
                        for row in self.connection.execute(
                            f"PRAGMA table_info({table})"
                        )
                    }
                    columns = [
                        column for column in source_columns if column in target_columns
                    ]
                    if not columns:
                        continue
                    names = ", ".join(columns)
                    placeholders = ", ".join("?" for _ in columns)
                    for row in previous.execute(f"SELECT {names} FROM {table}"):
                        cursor = self.connection.execute(
                            f"INSERT OR IGNORE INTO {table} ({names}) VALUES ({placeholders})",
                            tuple(row[column] for column in columns),
                        )
                        if table == "conversations":
                            imported += int(cursor.rowcount > 0)
                self.connection.execute(
                    "INSERT INTO schema_migrations VALUES (?, ?)",
                    (migration_version, utc_now()),
                )
        finally:
            previous.close()
        return imported

    def create_upload(
        self,
        conversation_id: str,
        filename: str,
        kind: str,
        mime: str,
        raw: bytes,
        text_content: str,
    ) -> Upload:
        self.get_conversation(conversation_id)
        upload_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO uploads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    upload_id,
                    conversation_id,
                    filename,
                    kind,
                    mime,
                    len(raw),
                    text_content,
                    raw if kind == "image" else None,
                    now,
                ),
            )
        return Upload(
            id=upload_id,
            conversation_id=conversation_id,
            filename=filename,
            kind=kind,
            mime=mime,
            size=len(raw),
            text_preview=text_content[:200],
            created_at=now,
        )

    def list_uploads(self, conversation_id: str) -> list[Upload]:
        with self.lock:
            rows = self.connection.execute(
                "SELECT * FROM uploads WHERE conversation_id = ? ORDER BY created_at",
                (conversation_id,),
            ).fetchall()
        return [
            Upload(
                id=row["id"],
                conversation_id=row["conversation_id"],
                filename=row["filename"],
                kind=row["kind"],
                mime=row["mime"],
                size=row["size"],
                text_preview=row["text_content"][:200],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def delete_upload(self, upload_id: str) -> None:
        with self.lock, self.connection:
            deleted = self.connection.execute(
                "DELETE FROM uploads WHERE id = ?", (upload_id,)
            ).rowcount
        if not deleted:
            raise KeyError(upload_id)

    def upload_texts(self, conversation_id: str) -> list[tuple[str, str, str]]:
        with self.lock:
            rows = self.connection.execute(
                "SELECT id, filename, text_content FROM uploads "
                "WHERE conversation_id = ? AND text_content != '' ORDER BY created_at",
                (conversation_id,),
            ).fetchall()
        return [(row["id"], row["filename"], row["text_content"]) for row in rows]

    def upload_images(self, conversation_id: str) -> list[tuple[str, str, str, str]]:
        with self.lock:
            rows = self.connection.execute(
                "SELECT id, filename, mime, content_blob FROM uploads "
                "WHERE conversation_id = ? AND kind = 'image' AND content_blob IS NOT NULL "
                "ORDER BY created_at",
                (conversation_id,),
            ).fetchall()
        return [
            (
                row["id"],
                row["filename"],
                row["mime"],
                base64.b64encode(row["content_blob"]).decode("ascii"),
            )
            for row in rows
        ]

    @staticmethod
    def _messages(rows: list[sqlite3.Row]) -> list[Message]:
        result = []
        for position, row in enumerate(rows):
            metadata = json.loads(row["metadata_json"] or "{}")
            result.append(
                Message(
                    id=row["id"],
                    position=position,
                    role=row["role"],
                    content=row["content"],
                    created_at=row["ts"],
                    run_id=row["run_id"],
                    metadata=metadata,
                )
            )
        return result

    @staticmethod
    def _conversation(row: sqlite3.Row, messages: list[Message]) -> Conversation:
        return Conversation(
            id=row["id"],
            title=row["title"],
            model=row["model"],
            pinned=bool(row["pinned"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            messages=messages,
        )

    @staticmethod
    def _snapshot(row: sqlite3.Row) -> RunSnapshot:
        return RunSnapshot(
            id=row["id"],
            status=row["status"],
            provider=row["provider"],
            model=row["model"],
            output=row["output"],
            error=row["error"],
            created_at=row["created_at"],
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            conversation_id=row["conversation_id"],
            metrics=json.loads(row["metrics_json"] or "{}"),
            receipt_hash=row["receipt_hash"],
        )
