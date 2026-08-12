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
    run_id: str | None = None
    metadata: dict[str, Any] = {}


class ConversationCreate(BaseModel):
    title: str = Field(default="New chat", min_length=1, max_length=200)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    pinned: bool | None = None


class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    model: str = "unknown"
    pinned: bool = False
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
    conversation_id: str | None = None
    metrics: dict[str, Any] = {}
    receipt_hash: str | None = None


class RunEvent(BaseModel):
    type: str
    run_id: str
    data: dict[str, Any] = {}
    timestamp: str = Field(default_factory=utc_now)


class ContextSection(BaseModel):
    kind: str
    estimated_tokens: int = 0
    included: bool = True
    reason: str | None = None


class ContextSource(BaseModel):
    id: str
    kind: str
    title: str
    preview: str
    estimated_tokens: int
    included: bool = True
    score: float | None = None
    trust: Literal["trusted", "suspicious", "quarantined"] = "trusted"


class SafetyFinding(BaseModel):
    id: str
    category: Literal["secret", "pii", "prompt_injection"]
    severity: Literal["low", "medium", "high"]
    preview: str
    message: str


class ProviderPolicy(BaseModel):
    allow_memory: bool = False
    allow_retrieval: bool = False
    allow_attachments: bool = False
    allow_web: bool = False
    allow_backpacks: bool = False


class TurnPreflight(BaseModel):
    provider: str
    model: str
    content: str = Field(min_length=1, max_length=200_000)
    temperature: float = Field(default=0.7, ge=0, le=2)
    include_memory: bool = True
    include_retrieval: bool = True
    include_attachments: bool = True
    include_web: bool = False
    include_backpack: bool = True
    backpack_id: str | None = None
    context_limit: int = Field(default=8192, ge=512, le=2_000_000)


class TurnCreate(TurnPreflight):
    plan_hash: str
    confirmed_finding_ids: list[str] = []
    excluded_source_ids: list[str] = []


class ContextPlan(BaseModel):
    plan_hash: str
    estimated_tokens: int
    budget_tokens: int
    sections: list[ContextSection]
    sources: list[ContextSource] = []
    findings: list[SafetyFinding] = []
    requires_confirmation: bool = False


class ConversationBranch(BaseModel):
    message_id: str
    title: str = Field(default="Branch", min_length=1, max_length=200)


class BackpackItemInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=100_000)


class BackpackCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    items: list[BackpackItemInput] = []


class BackpackItem(BackpackItemInput):
    id: str


class Backpack(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str
    items: list[BackpackItem] = []


class FocusCreate(BaseModel):
    conversation_id: str
    objective: str = Field(min_length=1, max_length=1000)
    success_criteria: str = Field(min_length=1, max_length=2000)
    constraints: list[str] = []
    turn_limit: int | None = Field(default=None, ge=1, le=1000)


class FocusSession(FocusCreate):
    id: str
    status: Literal["active", "completed", "abandoned"] = "active"
    created_at: str
    completed_at: str | None = None


class ReplayBundle(BaseModel):
    version: Literal[1] = 1
    run: RunSnapshot
    messages: list[ChatMessage]
    context: ContextPlan | None = None
    integrity: dict[str, str]


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)
    category: str = Field(default="fact", min_length=1, max_length=50)
    source_conversation_id: str | None = None


class Memory(MemoryCreate):
    id: str
    status: Literal["active", "quarantined", "archived"] = "active"
    pinned: bool = False
    created_at: str
    last_used_at: str
    use_count: int = 0
    quarantine_reason: str | None = None


class PresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    system_prompt: str = Field(default="", max_length=50_000)
    model_key: str = Field(default="", max_length=500)
    temperature: float = Field(default=0.7, ge=0, le=2)


class Preset(PresetCreate):
    id: str


class UploadCreate(BaseModel):
    conversation_id: str
    filename: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1, max_length=14_000_000)


class Upload(BaseModel):
    id: str
    conversation_id: str
    filename: str
    kind: Literal["document", "image"]
    mime: str = ""
    size: int
    text_preview: str = ""
    created_at: str


class ReplayCreate(BaseModel):
    provider: str
    model: str
    temperature: float | None = Field(default=None, ge=0, le=2)
