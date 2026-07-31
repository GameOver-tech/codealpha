import os
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile, HTTPException, status

from app.core.config import settings
from app.core.supabase_client import get_supabase_service

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".mp4", ".webm", ".m4a"}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB


def _get_file_ext(filename: str) -> str:
    """Get lowercase extension including the dot."""
    return Path(filename).suffix.lower()


def validate_media_file(file: UploadFile):
    """Validate file type and size. Raises 422 on failure."""
    ext = _get_file_ext(file.filename or "unknown")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    # Check size by reading a chunk
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)}MB allowed.",
        )


def upload_recording(
    file: UploadFile, candidate_id: UUID, interview_id: UUID
) -> str:
    """Upload a recording to Supabase Storage. Returns the public/private path."""
    sb = get_supabase_service()
    ext = _get_file_ext(file.filename or "recording.mp4")
    storage_path = f"{candidate_id}/{interview_id}{ext}"

    # Read file into memory
    file_bytes = file.file.read()

    bucket = settings.STORAGE_BUCKET

    # Ensure bucket exists (create if not — will fail silently if already exists)
    try:
        sb.storage.create_bucket(bucket, {"public": False})
    except Exception:
        pass  # bucket may already exist

    sb.storage.from_(bucket).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": file.content_type or "application/octet-stream"},
    )

    return storage_path


def get_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    """Get a signed URL for a private storage object."""
    sb = get_supabase_service()
    bucket = settings.STORAGE_BUCKET
    result = sb.storage.from_(bucket).create_signed_url(
        path=storage_path, expires_in=expires_in
    )
    return result.get("signedURL", "")


def download_recording_to_temp(storage_path: str) -> str:
    """Download a recording from storage to a temp file. Returns the temp file path."""
    sb = get_supabase_service()
    bucket = settings.STORAGE_BUCKET
    data = sb.storage.from_(bucket).download(storage_path)

    suffix = Path(storage_path).suffix or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.close()
    return tmp.name


def cleanup_temp_file(path: str):
    """Remove a temp file."""
    try:
        os.unlink(path)
    except Exception:
        pass
