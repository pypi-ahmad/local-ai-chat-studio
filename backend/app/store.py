from __future__ import annotations

import sqlite3
import threading
import uuid
from pathlib import Path

from backend.app.contracts import Conversation, Message, utc_now


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(conversation_id, position)
);
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT NOT NULL DEFAULT '',
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);
"""


class Store:
    def __init__(self, database_url: str) -> None:
        if database_url != ":memory:":
            Path(database_url).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(database_url, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.connection:
            self.connection.executescript(SCHEMA)

    def create_conversation(self, title: str) -> Conversation:
        conversation_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            self.connection.execute(
                "INSERT INTO conversations VALUES (?, ?, ?, ?)",
                (conversation_id, title, now, now),
            )
        return self.get_conversation(conversation_id)

    def list_conversations(self) -> list[Conversation]:
        with self.lock:
            rows = self.connection.execute(
                "SELECT * FROM conversations ORDER BY updated_at DESC"
            ).fetchall()
        return [self._conversation(row, []) for row in rows]

    def get_conversation(self, conversation_id: str) -> Conversation:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
            ).fetchone()
            if row is None:
                raise KeyError(conversation_id)
            messages = self.connection.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY position",
                (conversation_id,),
            ).fetchall()
        return self._conversation(row, [Message(**dict(item)) for item in messages])

    def add_message(self, conversation_id: str, role: str, content: str) -> Message:
        message_id, now = str(uuid.uuid4()), utc_now()
        with self.lock, self.connection:
            exists = self.connection.execute(
                "SELECT 1 FROM conversations WHERE id = ?", (conversation_id,)
            ).fetchone()
            if exists is None:
                raise KeyError(conversation_id)
            position = self.connection.execute(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM messages WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()[0]
            self.connection.execute(
                "INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?)",
                (message_id, conversation_id, position, role, content, now),
            )
            self.connection.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id)
            )
        return Message(id=message_id, position=position, role=role, content=content, created_at=now)

    @staticmethod
    def _conversation(row: sqlite3.Row, messages: list[Message]) -> Conversation:
        return Conversation(**dict(row), messages=messages)
