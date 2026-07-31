"""Utility helpers shared across services."""
import re
import uuid
from datetime import datetime, timezone

from app.core.config import settings


def generate_token() -> str:
    return uuid.uuid4().hex


def sanitize_filename(filename: str) -> str:
    """Keep the base name + safe extension for storage paths."""
    base = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    return base[:200]


def ensure_upload_dirs() -> tuple[str, str]:
    import os

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.GENERATED_DIR, exist_ok=True)
    return settings.UPLOAD_DIR, settings.GENERATED_DIR


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, float(value)))
