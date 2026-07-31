"""PDF download helpers — resolve a stored PDF to bytes for the client."""
from __future__ import annotations

from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import NotFoundError

logger = get_logger(__name__)


async def download_pdf_for_interview(storage_path: str, filename: str) -> tuple[bytes, str]:
    """Return (bytes, content_type) for a stored PDF.

    Tries local disk first (the path may be a relative local path), then
    Supabase Storage.
    """
    content_type = "application/pdf"

    local = Path(settings.GENERATED_DIR) / storage_path
    if local.is_file():
        return local.read_bytes(), content_type

    local_alt = Path(storage_path)
    if local_alt.is_file():
        return local_alt.read_bytes(), content_type

    if settings.SUPABASE_URL:
        try:
            from app.storage.service import SupabaseStorage

            storage = SupabaseStorage()
            data = storage.download(storage_path)
            if data:
                return data, content_type
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not download PDF from Supabase: %s", exc)

    raise NotFoundError("PDF file is not available")
