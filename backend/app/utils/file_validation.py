"""File validation for interview recordings (admin uploads)."""
import mimetypes
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.utils.exceptions import BadRequestError

ALLOWED_EXTENSIONS = {
    ".mp4", ".mov", ".avi", ".mkv",   # video
    ".mp3", ".wav", ".m4a", ".flac", ".aac",  # audio
}
ALLOWED_MIME_TYPES = {
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
    "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a",
    "audio/flac", "audio/aac", "audio/aacp",
}
MAX_FILE_BYTES = settings.STORAGE_MAX_FILE_MB * 1024 * 1024


def get_file_extension(filename: str) -> str:
    return Path(filename or "unknown").suffix.lower()


def validate_upload(file: UploadFile) -> None:
    """Validate extension, MIME type and size. Raises BadRequestError on failure."""
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise BadRequestError(
            f"File type '{ext or 'unknown'}' not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        raise BadRequestError(f"Content type '{content_type}' not allowed.")

    file.file.seek(0, 2)  # SEEK_END
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_BYTES:
        raise BadRequestError(
            f"File too large. Max {settings.STORAGE_MAX_FILE_MB}MB allowed."
        )


def human_size(num_bytes: int) -> str:
    """Format byte count into a human-readable string."""
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{num_bytes} B"
