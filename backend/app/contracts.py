from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

ReasoningEffort = Literal["none", "minimal", "low", "medium", "high", "xhigh", "max"]


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
    settings: "ConversationSettings | None" = None


class ConversationSettings(BaseModel):
    model_key: str = Field(default="", max_length=500)
    reasoning_effort: ReasoningEffort | None = None
    temperature: float = Field(default=0.7, ge=0, le=2)
    context_policy: Literal["full", "chat", "files"] = "full"
    include_web: bool = False
    auto_compress_history: bool = False
    system_prompt: str = Field(default="", max_length=50_000)
    layout: Literal["conversation", "compact", "full-width"] = "conversation"
    knowledge_base_id: str | None = Field(default=None, max_length=100)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    pinned: bool | None = None
    settings: ConversationSettings | None = None


class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    model: str = "unknown"
    pinned: bool = False
    settings: ConversationSettings = Field(default_factory=ConversationSettings)
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


class OpenCodeOAuthStart(BaseModel):
    method: int = Field(default=0, ge=0)


class OpenCodeOAuthComplete(OpenCodeOAuthStart):
    code: str | None = None


class ImageInput(BaseModel):
    mime: Literal["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]
    data_base64: str = Field(max_length=14_000_000)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str = Field(min_length=1)
    images: list[ImageInput] = Field(default_factory=list)


class ModelPricing(BaseModel):
    input_per_million: float
    output_per_million: float
    source_url: str
    as_of: str = "2026-08-14"


class ModelDescriptor(BaseModel):
    provider: str
    id: str
    label: str | None = None
    context_length: int | None = None
    capabilities: list[str] = []
    reasoning_efforts: list[ReasoningEffort] = []
    pricing: ModelPricing | None = None


class ProviderDiscovery(BaseModel):
    provider: str
    models: list[ModelDescriptor] = []
    error: str | None = None


class RunCreate(BaseModel):
    provider: str
    model: str
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0, le=2)
    reasoning_effort: ReasoningEffort | None = None
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
    url: str | None = None
    conversation_id: str | None = None
    trust: Literal["trusted", "suspicious", "quarantined"] = "trusted"


class SafetyFinding(BaseModel):
    id: str
    category: Literal["secret", "pii", "prompt_injection"]
    severity: Literal["low", "medium", "high"]
    preview: str
    message: str


class SafetyText(BaseModel):
    content: str = Field(min_length=1, max_length=100_000)


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
    reasoning_effort: ReasoningEffort | None = None
    system_prompt: str = Field(default="", max_length=50_000)
    include_memory: bool = True
    include_retrieval: bool = True
    include_attachments: bool = True
    include_web: bool = False
    include_backpack: bool = True
    attachment_ids: list[str] = Field(default_factory=list, max_length=20)
    backpack_id: str | None = None
    context_limit: int = Field(default=8192, ge=512, le=2_000_000)
    auto_compress_history: bool = False


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
    compression_applied: bool = False
    compressed_message_count: int = 0


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


class KnowledgeBaseSourceInput(BaseModel):
    kind: Literal["upload", "memory", "backpack"]
    source_id: str = Field(min_length=1, max_length=100)


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    include_retrieval: bool = True
    sources: list[KnowledgeBaseSourceInput] = Field(default_factory=list, max_length=200)


class KnowledgeBaseSource(KnowledgeBaseSourceInput):
    title: str
    preview: str = ""
    available: bool = True


class KnowledgeBase(BaseModel):
    id: str
    name: str
    description: str = ""
    include_retrieval: bool = True
    created_at: str
    updated_at: str
    sources: list[KnowledgeBaseSource] = []


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


class FocusUpdate(BaseModel):
    status: Literal["completed", "abandoned"]


class ProviderSimulationInput(BaseModel):
    scenario: Literal["auth", "timeout", "rate_limit", "disconnect", "malformed"]
    fallback_provider: str | None = None


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
    source_message_ids: list[str] = Field(default_factory=list)
    selection_reason: str | None = None
    extractor_provider: str | None = None
    extractor_model: str | None = None


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=20_000)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    status: Literal["active", "quarantined", "archived"] | None = None
    pinned: bool | None = None


class MemoryExtractionRequest(BaseModel):
    provider: str
    model: str
    cloud_confirmed: bool = False


class MemoryExtractionResult(BaseModel):
    saved: int = 0
    quarantined: int = 0
    discarded: int = 0


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


class FeedbackInput(BaseModel):
    rating: Literal[-1, 1]


class DataImport(BaseModel):
    jsonl: str = Field(max_length=50_000_000)


class WipeRequest(BaseModel):
    confirmation: Literal["WIPE"]


class V2ImportRequest(BaseModel):
    confirmation: Literal["IMPORT_V2"]


class Profile(BaseModel):
    content: str = Field(default="", max_length=50_000)


class McpServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    transport: Literal["stdio", "streamable_http"]
    command: str | None = Field(default=None, max_length=100)
    args: list[str] = Field(default_factory=list, max_length=40)
    env_keys: list[str] = Field(default_factory=list, max_length=20)
    url: str | None = Field(default=None, max_length=2_048)

    @field_validator("env_keys")
    @classmethod
    def _safe_env_names(cls, values: list[str]) -> list[str]:
        import re

        if any(not re.fullmatch(r"[A-Z][A-Z0-9_]{0,127}", value) for value in values):
            raise ValueError("Environment variable names must use A-Z, 0-9, and underscore")
        return list(dict.fromkeys(values))

    @field_validator("args")
    @classmethod
    def _bounded_args(cls, values: list[str]) -> list[str]:
        if any(len(value) > 1_000 or "\x00" in value for value in values):
            raise ValueError("Each argument must be at most 1000 characters")
        return values

    @model_validator(mode="after")
    def _valid_transport(self) -> "McpServerCreate":
        from pathlib import PurePath
        from urllib.parse import urlsplit

        if self.transport == "stdio":
            allowed = {"node", "npx", "py", "python", "python3", "uv", "uvx"}
            command = (self.command or "").strip()
            basename = PurePath(command).name.lower().removesuffix(".exe")
            if not command or basename not in allowed or basename != command.lower().removesuffix(".exe"):
                raise ValueError("stdio command must be an approved executable name without a path")
            if self.url:
                raise ValueError("stdio servers cannot define a URL")
        else:
            parsed = urlsplit(self.url or "")
            if parsed.scheme != "https" or not parsed.hostname:
                raise ValueError("Remote MCP servers require an HTTPS URL")
            if parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise ValueError("Remote MCP URLs cannot contain credentials, query, or fragment")
            if self.command or self.args or self.env_keys:
                raise ValueError("Remote MCP servers cannot define a local command or environment")
        return self


class McpServer(McpServerCreate):
    id: str
    command_preview: str
    tested_at: str | None = None
    created_at: str
    updated_at: str


class McpTool(BaseModel):
    server_id: str
    name: str
    title: str | None = None
    description: str | None = None
    input_schema: dict[str, Any] = Field(default_factory=dict)


class ToolRequestCreate(BaseModel):
    server_id: str
    tool_name: str = Field(min_length=1, max_length=200)
    arguments: dict[str, Any] = Field(default_factory=dict)
    rationale: str = Field(min_length=1, max_length=2_000)
    origin: Literal["user", "agent"] = "user"
    conversation_id: str | None = Field(default=None, max_length=100)


class ToolDecision(BaseModel):
    reason: str = Field(min_length=1, max_length=1_000)


class ToolRequest(BaseModel):
    id: str
    server_id: str
    server_name: str
    tool_name: str
    origin: Literal["user", "agent"]
    conversation_id: str | None = None
    rationale: str
    arguments: dict[str, Any] | None = None
    arguments_preview: dict[str, Any] = Field(default_factory=dict)
    argument_hash: str
    status: Literal["pending", "running", "completed", "denied", "failed"]
    decision_reason: str | None = None
    result_preview: str | None = None
    error: str | None = None
    created_at: str
    decided_at: str | None = None
    completed_at: str | None = None
