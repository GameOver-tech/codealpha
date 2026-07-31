"""Application settings loaded from environment / .env file.

All secrets live in environment variables only — never hardcode them.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> str:
    """Look for .env in the project root first, then in backend/."""
    this_file = Path(__file__).resolve()
    project_root = this_file.parents[3]  # backend/app/core/config.py -> project root
    candidates = [
        project_root / ".env",
        project_root / "backend" / ".env",
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return str(candidates[0])


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # --- Supabase ---
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"

    # --- App ---
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "dev-secret-key-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    ENABLE_RATE_LIMITING: bool = True
    RATE_LIMIT_REQUESTS: int = 60
    RATE_LIMIT_PERIOD_SECONDS: int = 60

    # --- Storage ---
    STORAGE_BUCKET: str = "interview-recordings"
    STORAGE_MAX_FILE_MB: int = 200

    # --- Deepgram ---
    DEEPGRAM_API_KEY: str = ""
    # nova-2 is available on standard plans; nova-3 requires a paid tier.
    DEEPGRAM_MODEL: str = "nova-2"

    # --- LLM Provider ---
    LLM_PROVIDER: str = "openrouter"  # openrouter | gemini | groq
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    LLM_MAX_TOKENS: int = 8192
    LLM_TEMPERATURE: float = 0.3

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_REDIS_QUEUE: bool = False

    # --- Scoring thresholds ---
    SCORE_THRESHOLD_RECOMMENDED: int = 75
    SCORE_THRESHOLD_NEEDS_REVIEW: int = 50

    # --- Uploads ---
    UPLOAD_DIR: str = str(Path(__file__).resolve().parents[3] / "uploads")
    GENERATED_DIR: str = str(Path(__file__).resolve().parents[3] / "generated")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
