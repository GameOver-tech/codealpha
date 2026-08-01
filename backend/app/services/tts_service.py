"""ElevenLabs Text-to-Speech service.

Responsibilities:
  - Synthesize speech from text via the ElevenLabs HTTP API.
  - Cache generated MP3 files on disk (keyed by text hash) so repeated
    requests never hit the API again.
  - Retry transient failures with backoff.
  - Return plain MP3 bytes to the router, which streams them to the client.

The API key is only ever read from settings (environment/.env) — it is
never exposed to the frontend.
"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from pathlib import Path

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError, NotFoundError, ServiceUnavailableError

logger = get_logger(__name__)

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
_MAX_TEXT_CHARS = settings.TTS_MAX_CHARS
_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = 1.0

# Voice metadata cache: {voice_id: {"name": ..., "labels": ...}}
_voice_meta_cache: dict[str, dict] = {}


def _text_key(text: str, voice_id: str) -> str:
    """Stable cache key: sha256 of (text + voice)."""
    digest = hashlib.sha256(f"{voice_id}:{text}".encode("utf-8")).hexdigest()
    return digest


def _cache_path(text: str, voice_id: str) -> Path:
    cache_dir = Path(settings.TTS_CACHE_DIR)
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"{_text_key(text, voice_id)}.mp3"


def _headers() -> dict[str, str]:
    return {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }


def _is_retryable(status_code: int) -> bool:
    # 429 (rate limit) and 5xx are transient — worth a retry with backoff.
    return status_code in (429, 500, 502, 503, 504)


async def _request_tts(text: str, voice_id: str, model_id: str) -> bytes:
    """Call ElevenLabs once (no retry logic here — the caller retries)."""
    url = f"{ELEVENLABS_BASE}/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": settings.TTS_STABILITY,
            "similarity_boost": settings.TTS_SIMILARITY,
        },
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=_headers(), json=payload)

    if response.status_code == 401:
        raise ServiceUnavailableError(
            "ElevenLabs API key is invalid or missing. Check ELEVENLABS_API_KEY."
        )
    if response.status_code == 404:
        raise NotFoundError(
            f"ElevenLabs voice '{voice_id}' not found. Check ELEVENLABS_VOICE_ID."
        )
    if response.status_code == 422:
        raise BadRequestError("Text is too long or unsupported for ElevenLabs TTS.")
    if response.status_code != 200:
        raise ServiceUnavailableError(
            f"ElevenLabs request failed with status {response.status_code}."
        )
    return response.content


async def synthesize_speech(
    text: str,
    *,
    voice_id: str | None = None,
    model_id: str | None = None,
    force: bool = False,
) -> bytes:
    """Synthesize MP3 audio for `text` with on-disk caching + retries.

    Returns raw MP3 bytes. Raises on invalid input or API failure.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        raise BadRequestError("text cannot be empty")
    if len(cleaned) > _MAX_TEXT_CHARS:
        raise BadRequestError(
            f"text is too long ({len(cleaned)} chars). Maximum is {_MAX_TEXT_CHARS}."
        )

    voice = voice_id or settings.ELEVENLABS_VOICE_ID
    model = model_id or settings.ELEVENLABS_MODEL_ID

    if not settings.ELEVENLABS_API_KEY:
        raise ServiceUnavailableError(
            "ELEVENLABS_API_KEY is not configured. Add it to backend/.env"
        )

    # Cache hit — return without calling the API.
    cache_file = _cache_path(cleaned, voice)
    if not force and cache_file.is_file():
        logger.info("TTS cache hit: %s", cache_file.name)
        return cache_file.read_bytes()

    last_exc: Exception | None = None
    for attempt in range(_RETRY_ATTEMPTS):
        try:
            audio = await _request_tts(cleaned, voice, model)
            # Best-effort cache write (never fail the request over caching).
            try:
                cache_file.write_bytes(audio)
            except OSError as exc:  # pragma: no cover
                logger.warning("TTS cache write failed: %s", exc)
            logger.info(
                "TTS synthesized: %s chars -> %s bytes (attempt %s/%s)",
                len(cleaned),
                len(audio),
                attempt + 1,
                _RETRY_ATTEMPTS,
            )
            return audio
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            status = getattr(exc, "status_code", None)
            if not _is_retryable(status) and status is not None:
                raise
            if attempt < _RETRY_ATTEMPTS - 1:
                await _sleep(_RETRY_BACKOFF_SECONDS * (2**attempt))

    raise ServiceUnavailableError(
        f"Text-to-speech failed after {_RETRY_ATTEMPTS} attempts: {last_exc}"
    )


async def _sleep(seconds: float) -> None:
    import asyncio

    await asyncio.sleep(seconds)


async def list_voices() -> list[dict]:
    """Return the available ElevenLabs voices (name, id, labels)."""
    if not settings.ELEVENLABS_API_KEY:
        raise ServiceUnavailableError(
            "ELEVENLABS_API_KEY is not configured. Add it to backend/.env"
        )
    url = f"{ELEVENLABS_BASE}/voices"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=_headers())
    if response.status_code != 200:
        raise ServiceUnavailableError(
            f"Could not list voices (status {response.status_code})."
        )
    payload = response.json()
    voices = payload.get("voices", [])
    return [
        {
            "id": v.get("voice_id", ""),
            "name": v.get("name", "Unknown"),
            "labels": v.get("labels", {}),
        }
        for v in voices
    ]
