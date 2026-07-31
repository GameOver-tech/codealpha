"""Deepgram speech-to-text service.

Produces a timestamped, speaker-annotated transcript from an uploaded
audio/video file. Video files are converted to audio first (ffmpeg), then
sent to the Deepgram API. The complete raw Deepgram response is returned
and stored so nothing is lost.

There is NO mock or fallback transcript in this module — if transcription
fails, an error is raised and processing stops.
"""
from __future__ import annotations

import asyncio
import subprocess
import time
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError, TranscriptionError

logger = get_logger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".aac"}

# ---------------------------------------------------------------------------
# Audio extraction (video -> audio)
# ---------------------------------------------------------------------------


def _is_video(path: Path) -> bool:
    return path.suffix.lower() in VIDEO_EXTENSIONS


def extract_audio(source_path: str, work_dir: str | None = None) -> str:
    """Extract a WAV stream from a video file using ffmpeg.

    Returns the path to the extracted audio file. The original file is
    never modified. Raises TranscriptionError if ffmpeg is unavailable or
    extraction fails.
    """
    source = Path(source_path)
    if not _is_video(source):
        return source_path

    import tempfile

    target_dir = Path(work_dir) if work_dir else Path(tempfile.gettempdir())
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{source.stem}_extracted.wav"

    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                str(target),
            ],
            capture_output=True,
            timeout=600,
        )
    except FileNotFoundError as exc:
        raise TranscriptionError(
            "ffmpeg is not installed. Install ffmpeg to transcribe video files."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise TranscriptionError("Audio extraction timed out.") from exc

    if result.returncode != 0 or not target.is_file():
        stderr = (result.stderr or b"").decode("utf-8", errors="replace")[-500:]
        raise TranscriptionError(f"Audio extraction failed: {stderr}")

    logger.info(
        "Audio extracted from %s -> %s (%s bytes)",
        source.name,
        target,
        target.stat().st_size,
    )
    return str(target)


# ---------------------------------------------------------------------------
# Deepgram API
# ---------------------------------------------------------------------------


def _segment_text(words: list[dict[str, Any]]) -> str:
    """Join Deepgram word objects into plain text."""
    return " ".join(w.get("word", "") for w in words).strip()


def _build_full_text(segments: list[dict[str, Any]]) -> str:
    """Concatenate segment texts into a readable transcript."""
    return "\n\n".join(seg.get("text", "") for seg in segments if seg.get("text"))


def _map_segments(
    utterance_groups: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Map Deepgram utterances to our segment schema (start/end/text/speaker)."""
    segments: list[dict[str, Any]] = []
    for utt in utterance_groups or []:
        words = utt.get("words") or []
        start = float(utt.get("start") or (words[0]["start"] if words else 0))
        end = float(utt.get("end") or (words[-1]["end"] if words else start))
        speaker = utt.get("speaker")
        text = _segment_text(words)
        if not text:
            continue
        segments.append(
            {
                "start": round(start, 2),
                "end": round(end, 2),
                "text": text,
                "speaker": str(speaker) if speaker is not None else None,
                "confidence": round(float(utt.get("confidence") or 0.0), 4),
            }
        )
    return segments


def _detected_speakers(segments: list[dict[str, Any]]) -> list[str]:
    """Return the ordered list of distinct speakers seen in the transcript."""
    seen: list[str] = []
    for seg in segments:
        spk = seg.get("speaker")
        if spk and spk not in seen:
            seen.append(spk)
    return seen


def _call_deepgram(file_path: str) -> dict[str, Any]:
    """Run Deepgram transcription (blocking call wrapped for async use).

    Retries transient failures (network timeouts, 5xx) with exponential
    backoff before giving up. Returns the complete raw ``results`` object.
    """
    try:
        from deepgram import DeepgramClient, PrerecordedOptions
    except ImportError as exc:  # pragma: no cover
        raise TranscriptionError(
            "deepgram-sdk is not installed. Install requirements."
        ) from exc

    if not settings.DEEPGRAM_API_KEY:
        raise TranscriptionError("DEEPGRAM_API_KEY is not configured.")

    client = DeepgramClient(settings.DEEPGRAM_API_KEY)

    options = PrerecordedOptions(
        model=settings.DEEPGRAM_MODEL,
        tier=settings.DEEPGRAM_TIER,
        punctuate=True,
        utterances=True,
        diarize=True,
        smart_format=True,
        detect_language=True,
    )

    mimetype = _guess_mimetype(file_path)
    with open(file_path, "rb") as audio:
        source = {"buffer": audio.read(), "mimetype": mimetype}

    logger.info(
        "Deepgram request: file=%s bytes=%s model=%s tier=%s",
        Path(file_path).name,
        len(source["buffer"]),
        settings.DEEPGRAM_MODEL,
        settings.DEEPGRAM_TIER,
    )

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = client.listen.prerecorded.v("1").transcribe_file(source, options)
            results = response.get("results", {})
            if not results:
                raise TranscriptionError("Deepgram returned an empty response")
            logger.info(
                "Deepgram response OK: status=%s",
                response.get("metadata", {}).get("request_id", "unknown"),
            )
            return results
        except TranscriptionError:
            raise
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            delay = 1.0 * (2**attempt)
            logger.warning(
                "Deepgram attempt %s/3 failed: %s. Retrying in %.1fs",
                attempt + 1,
                exc,
                delay,
            )
            if attempt < 2:
                time.sleep(delay)

    raise TranscriptionError(f"Deepgram transcription failed after 3 attempts: {last_exc}")


def _guess_mimetype(file_path: str) -> str:
    """Infer a sensible mimetype for Deepgram from the file extension."""
    ext = Path(file_path).suffix.lower()
    return {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
    }.get(ext, "audio/mpeg")


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def _validate_transcript(full_text: str) -> None:
    """Validate the transcript before it can be used downstream.

    Raises TranscriptionError when the transcript is empty or trivially
    short — processing must never continue with unusable content.
    """
    if not full_text or not full_text.strip():
        raise TranscriptionError("Deepgram returned an empty transcript.")
    if len(full_text.strip()) <= 20:
        raise TranscriptionError(
            "Transcript is too short to evaluate (must exceed 20 characters)."
        )


async def transcribe_audio(file_path: str) -> dict[str, Any]:
    """Transcribe a media file into a structured transcript.

    Returns a dict with:
      - full_text: the complete readable transcript
      - segments: [{start, end, text, speaker, confidence}]
      - speakers: ordered list of detected speakers
      - duration: audio length in seconds
      - language: detected language code
      - confidence: overall transcript confidence
      - source: "deepgram"
      - raw_response: the complete Deepgram results payload

    Raises TranscriptionError when transcription fails or the transcript
    fails validation. ``file_path`` may be relative to the uploads dir.
    """
    path = Path(file_path)
    if not path.is_absolute():
        candidate = Path(settings.UPLOAD_DIR) / file_path
        if candidate.is_file():
            path = candidate
    if not path.is_file():
        raise TranscriptionError(f"Recording file not found: {file_path}")

    logger.info(
        "Transcribing upload: filename=%s absolute_path=%s",
        path.name,
        path.resolve(),
    )

    # Extract audio for video files (original file untouched).
    audio_path = await asyncio.to_thread(extract_audio, str(path))
    extracted = audio_path != str(path)
    logger.info("Audio extraction status: %s", "extracted" if extracted else "not needed")

    try:
        results = await asyncio.to_thread(_call_deepgram, audio_path)
    except TranscriptionError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Deepgram transcription failed")
        raise TranscriptionError(f"Deepgram transcription failed: {exc}") from exc

    # Map utterances to segments; fall back to the first alternative's words.
    segments = _map_segments(results.get("utterances") or [])
    if not segments:
        channels = results.get("channels") or []
        alt = channels[0].get("alternatives", [{}])[0] if channels else {}
        words = alt.get("words") or []
        if words:
            segments = [
                {
                    "start": round(float(words[0]["start"]), 2),
                    "end": round(float(words[-1]["end"]), 2),
                    "text": _segment_text(words),
                    "speaker": None,
                    "confidence": round(float(alt.get("confidence") or 0.0), 4),
                }
            ]

    full_text = _build_full_text(segments)
    _validate_transcript(full_text)

    metadata = results.get("metadata", {}) or {}
    duration = round(float(metadata.get("duration", 0) or 0), 2)
    language = metadata.get("detected_language") or metadata.get("language") or "en"

    # Overall confidence: average of word-level confidence when available.
    confidences = [
        float(w.get("confidence", 0) or 0)
        for utt in (results.get("utterances") or [])
        for w in (utt.get("words") or [])
        if w.get("confidence") is not None
    ]
    overall_confidence = round(sum(confidences) / len(confidences), 4) if confidences else 0.0

    logger.info(
        "Transcript ready: length=%s preview=%r language=%s duration=%ss",
        len(full_text),
        full_text[:300],
        language,
        duration,
    )

    return {
        "full_text": full_text,
        "segments": segments,
        "speakers": _detected_speakers(segments),
        "duration": duration,
        "language": language,
        "confidence": overall_confidence,
        "source": "deepgram",
        "raw_response": results,
    }
