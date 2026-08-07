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


def _find_ffmpeg() -> str:
    """Locate the ffmpeg executable.

    Checks PATH first, then common install locations (winget, chocolatey,
    scoop, manual installs) so a freshly-installed ffmpeg works without a
    shell restart.
    """
    import shutil

    found = shutil.which("ffmpeg")
    if found:
        return found

    candidates = [
        Path.home() / "scoop" / "shims" / "ffmpeg.exe",
        Path("C:/ffmpeg/bin/ffmpeg.exe"),
        Path("C:/ProgramData/chocolatey/bin/ffmpeg.exe"),
        *sorted(Path.home().glob("AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/**/bin/ffmpeg.exe")),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return "ffmpeg"  # let subprocess raise the original FileNotFoundError


def _find_ffprobe() -> str:
    """Locate the ffprobe executable (ships with the ffmpeg toolchain).

    Mirrors ``_find_ffmpeg``: checks PATH first, then the common install
    locations (winget, chocolatey, scoop, manual installs).
    """
    import shutil

    found = shutil.which("ffprobe")
    if found:
        return found

    candidates = [
        Path.home() / "scoop" / "shims" / "ffprobe.exe",
        Path("C:/ffmpeg/bin/ffprobe.exe"),
        Path("C:/ProgramData/chocolatey/bin/ffprobe.exe"),
        *sorted(Path.home().glob("AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/**/bin/ffprobe.exe")),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return "ffprobe"  # let subprocess raise the original FileNotFoundError


def probe_media_duration(file_path: str) -> float:
    """Return the actual duration (seconds) of an audio/video file.

    Uses ffprobe (part of the ffmpeg toolchain already required by the
    pipeline) to read the container's real duration. Returns 0.0 when the
    duration cannot be determined (missing ffprobe, probe failure) so the
    caller can fall back to Deepgram metadata instead of failing the upload.
    """
    path = Path(file_path)
    if not path.is_file():
        return 0.0

    ffprobe_bin = _find_ffprobe()
    try:
        result = subprocess.run(
            [
                ffprobe_bin,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        logger.warning("ffprobe duration probe failed for %s", path.name)
        return 0.0

    if result.returncode != 0:
        logger.warning(
            "ffprobe duration probe error for %s: %s",
            path.name,
            (result.stderr or b"").decode("utf-8", errors="replace")[-300:],
        )
        return 0.0

    try:
        duration = float((result.stdout or b"").decode("utf-8", errors="replace").strip())
    except (TypeError, ValueError):
        return 0.0
    if not duration or duration < 0:
        return 0.0
    logger.info("Media duration probed for %s: %.2fs", path.name, duration)
    return duration


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

    ffmpeg_bin = _find_ffmpeg()
    try:
        result = subprocess.run(
            [
                ffmpeg_bin,
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

    if target.stat().st_size < 1024:
        raise TranscriptionError(
            "The video file has no audible audio track — nothing could be "
            "extracted. Upload a recording that contains speech."
        )

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
    """Map Deepgram utterances to our segment schema (start/end/text/speaker).

    Deepgram utterances carry a ``transcript`` field plus (optionally) word-
    level timestamps. The ``transcript`` is the source of truth for the text;
    ``words`` are used only for timestamps and confidence. Falling back to
    ``transcript`` prevents valid speech from being dropped when word
    timestamps are absent.
    """
    segments: list[dict[str, Any]] = []
    for utt in utterance_groups or []:
        words = utt.get("words") or []
        text = _segment_text(words) or (utt.get("transcript") or "").strip()
        if not text:
            continue
        start = float(utt.get("start") or (words[0]["start"] if words else 0))
        end = float(utt.get("end") or (words[-1]["end"] if words else start))
        speaker = utt.get("speaker")
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


def _results_to_dict(results) -> dict[str, Any]:
    """Normalize the Deepgram SDK response to a plain dict.

    The SDK returns typed objects (PrerecordedResponse / Results) in newer
    versions; older versions return plain dicts. Both are handled here.
    """
    if isinstance(results, dict):
        return results
    if hasattr(results, "to_dict"):
        return results.to_dict()
    return dict(results)


def _call_deepgram(file_path: str) -> dict[str, Any]:
    """Run Deepgram transcription (blocking call wrapped for async use).

    The file is streamed to Deepgram from an open file handle (StreamSource)
    instead of buffering the whole recording in memory, and an explicit
    httpx timeout that scales with file size is passed to the SDK so large
    uploads are not cut short by the client default. Retries transient
    failures with exponential backoff. Returns the raw ``results`` dict.
    """
    try:
        import httpx

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
        punctuate=True,
        utterances=True,
        diarize=True,
        smart_format=True,
        detect_language=True,
    )

    path = Path(file_path)
    size_bytes = path.stat().st_size
    mimetype = _guess_mimetype(file_path)

    # Generous, size-scaled timeout so large recordings upload completely.
    timeout = httpx.Timeout(_deepgram_timeout_for_size(size_bytes), connect=30.0)

    logger.info(
        "Deepgram request: file=%s bytes=%s model=%s timeout=%ss",
        path.name,
        size_bytes,
        settings.DEEPGRAM_MODEL,
        _deepgram_timeout_for_size(size_bytes),
    )

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            # StreamSource streams the open file handle — no full in-memory copy.
            with open(file_path, "rb") as audio:
                source = {"stream": audio, "mimetype": mimetype}
                results = client.listen.prerecorded.v("1").transcribe_file(
                    source, options, timeout=timeout
                )
            results = _results_to_dict(results)
            # The SDK response object's to_dict() wraps the payload under
            # "results"; unwrap it so callers see {channels, utterances, ...}.
            if "results" in results and isinstance(results["results"], dict):
                results = results["results"]
            if not results:
                raise TranscriptionError("Deepgram returned an empty response")
            logger.info(
                "Deepgram response OK: request_id=%s",
                (results.get("metadata") or {}).get("request_id", "unknown"),
            )
            return results
        except TranscriptionError:
            raise
        except TimeoutError as exc:
            last_exc = exc
            logger.warning("Deepgram attempt %s/3 timed out", attempt + 1)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.warning(
                "Deepgram attempt %s/3 failed: %s",
                attempt + 1,
                exc,
            )
        if attempt < 2:
            time.sleep(1.0 * (2**attempt))

    raise TranscriptionError(f"Deepgram transcription failed after 3 attempts: {last_exc}")


def _deepgram_timeout_for_size(size_bytes: int) -> int:
    """Pick a wall-clock timeout that scales with upload size.

    Base 90s for small files, +30s per 25MB beyond the first 25MB, capped
    at 10 minutes so a genuinely large recording is never cut short.
    """
    base = DEEPGRAM_CALL_TIMEOUT_SECONDS
    extra = int(max(0, (size_bytes - 25 * 1024 * 1024)) // (25 * 1024 * 1024)) * 30
    return min(base + extra, 600)


DEEPGRAM_CALL_TIMEOUT_SECONDS = 90


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


def _has_usable_speech(full_text: str) -> bool:
    """Return whether a transcript contains enough speech to evaluate.

    Empty/whitespace-only transcripts and trivially short ones (≤ 20 chars)
    are treated as "no speech" — the pipeline completes the interview but
    skips transcript/evaluation/PDF generation.
    """
    if not full_text or not full_text.strip():
        return False
    if len(full_text.strip()) <= 20:
        return False
    return True


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
      - has_speech: whether the recording contained usable audible speech

    Raises TranscriptionError when transcription fails. ``file_path`` may
    be relative to the uploads dir. Empty/too-short transcripts do NOT raise
    — they are reported via ``has_speech=False`` so the pipeline can skip
    evaluation instead of failing.
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
        alt_text = (alt.get("transcript") or "").strip()
        if words or alt_text:
            segments = [
                {
                    "start": round(float(words[0]["start"]), 2) if words else 0.0,
                    "end": round(float(words[-1]["end"]), 2) if words else 0.0,
                    "text": _segment_text(words) or alt_text,
                    "speaker": None,
                    "confidence": round(float(alt.get("confidence") or 0.0), 4),
                }
            ]

    full_text = _build_full_text(segments)
    has_speech = _has_usable_speech(full_text)

    metadata = results.get("metadata", {}) or {}
    duration = round(float(metadata.get("duration", 0) or 0), 2)
    # Fallback: when Deepgram omits metadata duration, derive it from the
    # last segment's end timestamp so the pipeline never stores 0 seconds.
    if not duration and segments:
        last_end = max((float(s.get("end") or 0) for s in segments), default=0.0)
        duration = round(last_end, 2)
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
        "Transcript ready: length=%s preview=%r language=%s duration=%ss has_speech=%s",
        len(full_text),
        full_text[:300],
        language,
        duration,
        has_speech,
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
        "has_speech": has_speech,
    }
