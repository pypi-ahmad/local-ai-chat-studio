from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class MessageCreate(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str = Field(min_length=1)


class Message(MessageCreate):
    id: str
    position: int
    created_at: str


class ConversationCreate(BaseModel):
    title: str = Field(default="New chat", min_length=1, max_length=200)


class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: list[Message] = []


class CredentialInput(BaseModel):
    api_key: str = Field(min_length=1)

    @field_validator("api_key")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("api_key must not be blank")
        return value


class OAuthCodeInput(BaseModel):
    code: str = Field(min_length=1)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str = Field(min_length=1)


class ModelDescriptor(BaseModel):
    provider: str
    id: str
    label: str | None = None
    context_length: int | None = None
    capabilities: list[str] = []


class ProviderDiscovery(BaseModel):
    provider: str
    models: list[ModelDescriptor] = []
    error: str | None = None


class RunCreate(BaseModel):
    provider: str
    model: str
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0, le=2)
    conversation_id: str | None = None


class RunStatus(StrEnum):
    queued = "queued"
    running = "running"
    completed = "completed"
    cancelled = "cancelled"
    failed = "failed"


class RunSnapshot(BaseModel):
    id: str
    status: RunStatus
    provider: str
    model: str
    output: str = ""
    error: str | None = None
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None


class RunEvent(BaseModel):
    type: str
    run_id: str
    data: dict[str, Any] = {}
    timestamp: str = Field(default_factory=utc_now)
