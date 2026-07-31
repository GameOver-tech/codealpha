"""Storage abstraction — local filesystem primary, optional Supabase Storage sync."""
import os
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)


class LocalStorage:
    """Store uploaded files under settings.UPLOAD_DIR."""

    def __init__(self, base_dir: str | None = None):
        self.base_dir = Path(base_dir or settings.UPLOAD_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _abs(self, rel_path: str) -> Path:
        target = (self.base_dir / rel_path).resolve()
        if not str(target).startswith(str(self.base_dir.resolve())):
            raise BadRequestError("Invalid storage path")
        target.parent.mkdir(parents=True, exist_ok=True)
        return target

    def abs_path(self, rel_path: str) -> str:
        """Return the absolute filesystem path for a stored relative path."""
        return str(self._abs(rel_path))

    def save_upload(
        self, file: UploadFile, subdir: str, filename: str | None = None
    ) -> tuple[str, int]:
        """Save an UploadFile. Returns (rel_path, size_bytes)."""
        safe_name = filename or (file.filename or "file")
        rel_path = f"{subdir}/{uuid.uuid4().hex}_{safe_name}"
        abs_path = self._abs(rel_path)

        size = 0
        with abs_path.open("wb") as out:
            while chunk := file.file.read(1024 * 1024):
                out.write(chunk)
                size += len(chunk)
        file.file.seek(0)
        return rel_path, size

    def save_bytes(self, data: bytes, rel_path: str) -> str:
        abs_path = self._abs(rel_path)
        abs_path.write_bytes(data)
        return rel_path

    def open(self, rel_path: str) -> BinaryIO:
        return self._abs(rel_path).open("rb")

    def exists(self, rel_path: str) -> bool:
        return self._abs(rel_path).exists()

    def size(self, rel_path: str) -> int:
        return self._abs(rel_path).stat().st_size

    def delete(self, rel_path: str) -> bool:
        try:
            abs_path = self._abs(rel_path)
            if abs_path.is_file():
                abs_path.unlink()
                return True
        except FileNotFoundError:
            pass
        return False

    def public_url(self, rel_path: str) -> str:
        """Return a URL for a stored file (local dev only)."""
        return f"/media/{rel_path}"


class SupabaseStorage:
    """Optional sync of files to Supabase Storage (interview-recordings bucket)."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            from supabase import create_client

            if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
                return None
            self._client = create_client(
                settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
            )
            try:
                # storage3 signature: create_bucket(id, name=None, options=None)
                self._client.storage.create_bucket(
                    id=settings.STORAGE_BUCKET, options={"public": False}
                )
            except Exception as exc:  # noqa: BLE001
                # Bucket already exists or lacks permission — proceed anyway.
                logger.warning("Could not ensure storage bucket: %s", exc)
        return self._client

    def upload(self, local_path: str, dest_path: str) -> str:
        """Upload a file to Supabase Storage with 3 retry attempts."""
        client = self._get_client()
        if client is None:
            return dest_path
        import time

        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                with open(local_path, "rb") as f:
                    client.storage.from_(settings.STORAGE_BUCKET).upload(
                        path=dest_path,
                        file=f,
                        file_options={"content-type": "application/octet-stream"},
                    )
                logger.info(
                    "Storage upload OK: %s -> %s (attempt %s/3)",
                    local_path,
                    dest_path,
                    attempt + 1,
                )
                return dest_path
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning(
                    "Storage upload attempt %s/3 failed for %s: %s",
                    attempt + 1,
                    dest_path,
                    exc,
                )
                if attempt < 2:
                    time.sleep(1.0 * (2**attempt))
        raise RuntimeError(f"Storage upload failed after 3 attempts: {last_exc}")

    def signed_url(self, path: str, expires_in: int = 3600) -> str:
        client = self._get_client()
        if client is None:
            return ""
        try:
            result = client.storage.from_(settings.STORAGE_BUCKET).create_signed_url(
                path=path, expires_in=expires_in
            )
            if isinstance(result, dict):
                return result.get("signedURL", "") or ""
            return str(getattr(result, "signedURL", "") or "")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to create signed URL for %s: %s", path, exc)
            return ""

    def download(self, path: str) -> bytes | None:
        """Download a file from the storage bucket, if configured."""
        client = self._get_client()
        if client is None:
            return None
        try:
            data = client.storage.from_(settings.STORAGE_BUCKET).download(path)
            return data if isinstance(data, bytes) else bytes(data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to download %s from storage: %s", path, exc)
            return None

    def delete(self, path: str) -> None:
        client = self._get_client()
        if client is None:
            return
        try:
            client.storage.from_(settings.STORAGE_BUCKET).remove([path])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to delete %s from storage: %s", path, exc)


def copy_local_to_supabase(local_path: str, dest_path: str) -> str:
    """Copy a local file to Supabase Storage. Returns the remote path."""
    if not settings.SUPABASE_URL:
        return dest_path
    storage = SupabaseStorage()
    return storage.upload(local_path, dest_path)


def cleanup_local_file(path: str) -> None:
    try:
        if os.path.isfile(path):
            os.remove(path)
    except OSError as exc:  # noqa: BLE001
        logger.warning("Cleanup failed for %s: %s", path, exc)


def clear_directory(path: str) -> None:
    shutil.rmtree(path, ignore_errors=True)
