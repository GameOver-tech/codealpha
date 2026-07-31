"""Speech analysis — prosody metrics derived from the transcript + audio metadata.

Analyzes speech speed (WPM), pauses, speaking rate, and produces
confidence/tone/emotion/clarity/fluency/energy scores. When a real
transcription exists, metrics are computed from segment timing; otherwise
a deterministic mock is returned (mock mode).
"""
from __future__ import annotations

import math
import re
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


def _word_count(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))


def _derive_metrics(segments: list[dict[str, Any]], duration: float) -> dict[str, float]:
    """Compute WPM, pause stats and speaking rate from timestamped segments."""
    total_words = sum(_word_count(seg.get("text", "")) for seg in segments)
    if not segments:
        return {"wpm": 0.0, "pauses": 0, "avg_pause": 0.0, "rate": 0.0, "speech_seconds": 0.0}

    # Speech time: sum of segment durations; pause time: gaps between segments.
    speech_seconds = sum(max(0.0, seg.get("end", 0) - seg.get("start", 0)) for seg in segments)
    gaps: list[float] = []
    for prev, cur in zip(segments, segments[1:]):
        gap = cur.get("start", 0) - prev.get("end", 0)
        if gap > 0.15:  # pauses longer than 150ms count
            gaps.append(gap)

    minutes = max(speech_seconds / 60.0, 0.001)
    wpm = round(total_words / minutes, 1)
    avg_pause = round(sum(gaps) / len(gaps), 2) if gaps else 0.0
    return {
        "wpm": wpm,
        "pauses": len(gaps),
        "avg_pause": avg_pause,
        "rate": round(total_words / max(speech_seconds, 0.001), 2),
        "speech_seconds": round(speech_seconds, 2),
    }


def _score_qualities(metrics: dict[str, float]) -> dict[str, Any]:
    """Map derived metrics to 0-100 quality scores + qualitative labels."""
    wpm = metrics["wpm"]
    pauses = metrics["pauses"]

    # Ideal conversational pace ~120-160 WPM.
    if wpm == 0:
        clarity = fluency = energy = 60.0
        pace_note = "Could not determine pace"
    else:
        pace_score = max(0.0, 100.0 - 2.5 * abs(wpm - 140))
        clarity = round(min(100.0, pace_score), 1)
        # Too few pauses <-> rushed; too many <-> fragmented.
        fluency = round(max(0.0, min(100.0, 100.0 - abs(pauses - 12) * 2.0)), 1)
        energy = round(max(0.0, min(100.0, 60.0 + pace_score * 0.4)), 1)
        pace_note = (
            "Good conversational pace" if 120 <= wpm <= 160
            else "Rapid delivery" if wpm > 160
            else "Deliberate, slower pace"
        )

    confidence = round(0.5 * fluency + 0.5 * clarity, 1)
    tone = "Professional" if clarity >= 70 else "Neutral"
    emotion = "Engaged"

    notes = (
        f"{pace_note}. Average speech rate {metrics['rate']} words/second, "
        f"{metrics['pauses']} notable pauses averaging {metrics['avg_pause']}s."
    )

    return {
        "confidence": confidence,
        "tone": tone,
        "emotion": emotion,
        "clarity": clarity,
        "fluency": fluency,
        "energy": energy,
        "notes": notes,
    }


def _mock_speech_analysis() -> dict[str, Any]:
    """Deterministic mock analysis for development without audio access."""
    return {
        "speech_speed_wpm": 148.0,
        "avg_pause_seconds": 0.6,
        "total_pauses": 9,
        "speaking_rate": 2.4,
        "confidence": 82.0,
        "tone": "Professional",
        "emotion": "Engaged",
        "clarity": 85.0,
        "fluency": 80.0,
        "energy": 74.0,
        "notes": "Good conversational pace (148 WPM) with natural pauses. Delivery is clear, fluent, and professional.",
    }


async def analyze_speech(
    transcript: dict[str, Any] | None = None, *, mock: bool = False
) -> dict[str, Any]:
    """Analyze speech characteristics from a transcript.

    Args:
        transcript: dict with "segments" (list of {start, end, text}) and
            optional "duration".
        mock: force mock output (used in mock mode / when no transcript exists).
    """
    if mock or not transcript or not transcript.get("segments"):
        return _mock_speech_analysis()

    segments = transcript["segments"]
    duration = float(transcript.get("duration") or 0.0)
    metrics = _derive_metrics(segments, duration)
    qualities = _score_qualities(metrics)

    return {
        "speech_speed_wpm": metrics["wpm"],
        "avg_pause_seconds": metrics["avg_pause"],
        "total_pauses": metrics["pauses"],
        "speaking_rate": metrics["rate"],
        "confidence": qualities["confidence"],
        "tone": qualities["tone"],
        "emotion": qualities["emotion"],
        "clarity": qualities["clarity"],
        "fluency": qualities["fluency"],
        "energy": qualities["energy"],
        "notes": qualities["notes"],
    }
