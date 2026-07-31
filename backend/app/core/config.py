from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


def _find_env_file() -> str:
    """Look for .env in project root first, then in backend/."""
    this_file = Path(__file__).resolve()
    # Project root = 4 levels up from backend/app/core/config.py
    project_root = this_file.parents[3]
    candidates = [
        project_root / ".env",                        # HireLens-AI-Backend/.env
        project_root / "backend" / ".env",            # HireLens-AI-Backend/backend/.env
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return str(candidates[0])  # fallback to project root


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str = ""

    # Storage
    STORAGE_BUCKET: str = "interview-recordings"

    # AI Services
    WHISPER_API_KEY: str = ""
    CLAUDE_API_KEY: str = ""

    # Mock mode
    USE_MOCK_AI: bool = False

    # Scoring thresholds
    SCORE_THRESHOLD_RECOMMENDED: int = 75
    SCORE_THRESHOLD_NEEDS_REVIEW: int = 50

    @property
    def mock_mode(self) -> bool:
        return self.USE_MOCK_AI or not self.WHISPER_API_KEY or not self.CLAUDE_API_KEY


settings = Settings()
