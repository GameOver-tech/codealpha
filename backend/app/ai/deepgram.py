"""Deepgram speech-to-text service.

Produces a timestamped, speaker-annotated transcript from an audio/video file.
Falls back to a realistic mock transcript when no API key is configured
(USE_MOCK_AI=true or missing DEEPGRAM_API_KEY).
"""
from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)


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
    backoff before giving up.
    """
    try:
        from deepgram import DeepgramClient, PrerecordedOptions
    except ImportError as exc:  # pragma: no cover
        raise BadRequestError(
            "deepgram-sdk is not installed. Install requirements or enable mock mode."
        ) from exc

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

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = client.listen.prerecorded.v("1").transcribe_file(source, options)
            results = response.get("results", {})
            if not results:
                raise BadRequestError("Deepgram returned an empty response")
            return results
        except BadRequestError:
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

    raise BadRequestError(f"Deepgram transcription failed after 3 attempts: {last_exc}")


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
    }.get(ext, "audio/mp4")


def _mock_transcript() -> dict[str, Any]:
    """Return a deterministic mock transcript for local development."""
    mock_texts = [
        ("Interviewer", 0.0, 12.5, "Thank you for joining us today. Let's start with your background. Can you tell us about your experience with Python and backend development?"),
        ("Candidate", 12.6, 45.2, "Sure. I've been working with Python for about five years now. My last role was at a fintech startup where I built REST APIs using FastAPI and Django. I worked on a payment processing system handling about fifty thousand transactions per day, and I was responsible for the entire backend architecture, including database design, async task queues, and CI/CD pipelines."),
        ("Interviewer", 45.3, 60.1, "That sounds relevant. How did you handle data consistency during a recent microservices migration?"),
        ("Candidate", 60.2, 95.8, "We used the Saga pattern with a choreography approach. Each service published events when its local transaction completed, and downstream services consumed those events. For rollbacks we implemented compensating transactions, and we added idempotency keys to all critical endpoints so replaying a message would not double process a transaction."),
        ("Interviewer", 95.9, 108.4, "Let's talk about a technical problem you solved recently. Walk me through your approach."),
        ("Candidate", 108.5, 148.0, "We had a performance issue where a reporting query took over thirty seconds to run. I profiled it with EXPLAIN ANALYZE and found a sequential scan on a table with two million rows. I added a composite index and the query dropped to two hundred milliseconds. I also introduced query caching with Redis, which reduced the average report load time by ninety five percent."),
        ("Interviewer", 148.1, 155.0, "How do you stay up to date with new technologies?"),
        ("Candidate", 155.1, 188.0, "I follow engineering blogs, contribute to open source, and attend PyCon and local meetups. I believe in learning by building, so I have a side project experimenting with WebSockets and real time data streaming."),
        ("Interviewer", 188.1, 196.0, "Why do you want to work here?"),
        ("Candidate", 196.1, 231.5, "I have been following your company's work in the AI space for a while. The problems you are solving with natural language processing are genuinely interesting to me. I think my experience building scalable backend systems would let me contribute from day one."),
    ]

    segments = [
        {"start": start, "end": end, "text": text, "speaker": speaker}
        for speaker, start, end, text in mock_texts
    ]
    return {
        "segments": segments,
        "speakers": _detected_speakers(segments),
        "full_text": _build_full_text(segments),
        "duration": round(segments[-1]["end"], 2),
        "mock": True,
    }


async def transcribe_audio(file_path: str) -> dict[str, Any]:
    """Transcribe a media file into a structured transcript.

    Returns a dict with:
      - full_text: the complete readable transcript
      - segments: [{start, end, text, speaker}]
      - speakers: ordered list of detected speakers
      - duration: audio length in seconds

    ``file_path`` may be relative to the uploads directory (as stored in the
    DB) or an absolute path.
    """
    path = Path(file_path)
    if not path.is_absolute():
        candidate = Path(settings.UPLOAD_DIR) / file_path
        if candidate.is_file():
            path = candidate
    if not path.is_file():
        raise BadRequestError(f"Recording file not found: {file_path}")

    if not settings.DEEPGRAM_API_KEY or settings.USE_MOCK_AI:
        logger.info("Mock mode enabled — returning mock transcript")
        return _mock_transcript()

    try:
        results = await asyncio.to_thread(_call_deepgram, str(path))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Deepgram transcription failed")
        raise BadRequestError(f"Speech-to-text failed: {exc}") from exc

    # Prefer utterances (multi-speaker aware); fall back to a single
    # segment built from the first alternative's words.
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
                }
            ]

    full_text = _build_full_text(segments)
    if not full_text:
        raise BadRequestError("Deepgram returned an empty transcript")

    return {
        "full_text": full_text,
        "segments": segments,
        "speakers": _detected_speakers(segments),
        "duration": round(float(results.get("metadata", {}).get("duration", 0) or 0), 2),
    }
