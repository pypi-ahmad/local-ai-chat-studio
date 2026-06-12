"""Application configuration via Pydantic Settings (env-overridable)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class AppConfig(BaseSettings):
    """Settings for the local AI chat studio.

    Every field can be overridden with an env var prefixed ``CHAT_``,
    e.g. ``CHAT_OLLAMA_HOST=http://192.168.1.5:11434``.
    """

    model_config = SettingsConfigDict(env_prefix="CHAT_", env_file=".env", extra="ignore")

    ollama_host: str = "http://localhost:11434"
    data_dir: Path = PROJECT_ROOT / "data"

    # Generation defaults (user-adjustable in Settings page)
    temperature: float = 0.7
    keep_alive: str = "10m"  # how long Ollama keeps a model in VRAM
    request_timeout: float = 300.0  # seconds; caps a hung/slow Ollama request

    # Feature toggles
    show_cloud_models: bool = True  # Ollama :cloud models (run on ollama.com account)
    memory_enabled: bool = True
    cross_chat_references: bool = True

    # Retrieval / memory tuning
    chunk_chars: int = 3200  # ~800 tokens
    chunk_overlap_chars: int = 400
    doc_context_budget_chars: int = 24_000  # inject doc directly if under this
    rag_top_k: int = 5
    cross_chat_top_k: int = 4
    cross_chat_min_similarity: float = 0.35
    memory_max_injected: int = 12
    memory_decay_days: int = 90  # archive unpinned memories unused this long
    profile_refresh_every: int = 5  # rebuild user profile every N conversations

    @property
    def db_path(self) -> Path:
        return self.data_dir / "app.db"

    @property
    def chroma_dir(self) -> Path:
        return self.data_dir / "chroma"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.chroma_dir, self.uploads_dir):
            p.mkdir(parents=True, exist_ok=True)


config = AppConfig()
config.ensure_dirs()
