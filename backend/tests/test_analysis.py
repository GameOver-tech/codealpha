"""Tests for transcript handling and the speech/sentiment analyzers.

These exercise the REAL analysis paths only — there is no mock data in
the application, so none is used here.
"""
import asyncio
from pathlib import Path

import pytest

from app.ai import analyze_sentiment, analyze_speech
from app.ai.deepgram import (
    _build_full_text,
    _map_segments,
    _validate_transcript,
    extract_audio,
    _is_video,
    probe_media_duration,
)
from app.utils.exceptions import TranscriptionError

SEGMENTS = [
    {"start": 0.0, "end": 3.0, "text": "Good morning, thank you for the opportunity.",
     "speaker": "Interviewer"},
    {"start": 3.2, "end": 9.0, "text": "I have five years of Python experience building APIs.",
     "speaker": "Candidate"},
    {"start": 9.5, "end": 12.0, "text": "We solved a hard performance problem.",
     "speaker": "Candidate"},
]


def run(coro):
    """Run an async coroutine in a fresh event loop (pytest-asyncio optional)."""
    return asyncio.new_event_loop().run_until_complete(coro)


# --- Deepgram helpers -------------------------------------------------------


def test_map_segments_drops_empty_utterances():
    utterances = [
        {"start": 0.1, "end": 2.0, "words": [{"word": "hello"}, {"word": "there"}], "speaker": 0},
        {"start": 3.0, "end": 4.0, "words": [], "speaker": 1},
    ]
    segments = _map_segments(utterances)
    assert len(segments) == 1
    assert segments[0]["text"] == "hello there"
    assert segments[0]["speaker"] == "0"
    assert "confidence" in segments[0]


def test_build_full_text_joins_segments():
    text = _build_full_text([{"text": "First."}, {"text": "Second."}, {"text": ""}])
    assert text == "First.\n\nSecond."


def test_validate_transcript_rejects_empty():
    with pytest.raises(TranscriptionError):
        _validate_transcript("")
    with pytest.raises(TranscriptionError):
        _validate_transcript("   ")


def test_validate_transcript_rejects_too_short():
    with pytest.raises(TranscriptionError):
        _validate_transcript("Hello.")


def test_validate_transcript_accepts_real_content():
    # No exception should be raised.
    _validate_transcript("Thank you for joining. I have five years of experience building APIs.")


def test_is_video():
    assert _is_video(__import__("pathlib").Path("clip.mp4")) is True
    assert _is_video(__import__("pathlib").Path("clip.mov")) is True
    assert _is_video(__import__("pathlib").Path("clip.mp3")) is False
    assert _is_video(__import__("pathlib").Path("clip.wav")) is False


def test_extract_audio_passthrough_for_audio_files(tmp_path_factory=None):
    """Audio files are returned unchanged — no ffmpeg call."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp) / "interview.mp3"
        audio.write_bytes(b"not real audio but extension is what matters")
        result = extract_audio(str(audio))
        assert result == str(audio)


def test_probe_media_duration_missing_file_returns_zero():
    assert probe_media_duration(str(Path("does-not-exist-xyz.mp4"))) == 0.0


def test_probe_media_duration_reads_real_audio():
    """The probe must return the actual media duration (Issue: 0m 00s)."""
    import shutil
    import subprocess
    import tempfile

    if shutil.which("ffmpeg") is None and shutil.which("ffprobe") is None:
        pytest.skip("ffmpeg toolchain not available")
    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp) / "probe.wav"
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=5.5",
                "-ar", "16000", "-ac", "1", str(audio),
            ],
            capture_output=True,
            timeout=60,
        )
        if result.returncode != 0:
            pytest.skip("ffmpeg could not generate test audio")
        duration = probe_media_duration(str(audio))
        assert duration > 0
        assert abs(duration - 5.5) < 0.6


# --- Speech analysis --------------------------------------------------------


def test_speech_metrics_derived_from_segments():
    speech = run(
        analyze_speech(
            {"segments": SEGMENTS, "duration": 12.0},
        )
    )
    assert speech["speech_speed_wpm"] > 0
    assert 0 <= speech["confidence"] <= 100
    assert 0 <= speech["clarity"] <= 100
    assert 0 <= speech["fluency"] <= 100
    assert 0 <= speech["energy"] <= 100
    assert speech["speaking_rate"] > 0
    assert isinstance(speech["total_pauses"], int)


def test_speech_analysis_no_segments_returns_zeros():
    speech = run(analyze_speech({"segments": []}))
    assert speech["speech_speed_wpm"] == 0.0
    assert speech["confidence"] == 0.0
    assert speech["tone"] == ""


# --- Sentiment analysis -----------------------------------------------------


def test_sentiment_positive_text():
    text = (
        "I successfully delivered a scalable system and I am proud of the "
        "teamwork and the positive results we achieved."
    )
    result = run(analyze_sentiment({"full_text": text}))
    assert result["sentiment"] in ("Positive", "Neutral")
    assert 0 <= result["confidence"] <= 100
    assert 0 <= result["professionalism"] <= 100
    assert result["summary"]


def test_sentiment_empty_text_returns_neutral():
    result = run(analyze_sentiment({"full_text": ""}))
    assert result["sentiment"] == "Neutral"
    assert result["emotion"] == "Neutral"
