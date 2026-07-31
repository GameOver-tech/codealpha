"""Tests for transcript handling and the speech/sentiment analyzers."""
import asyncio

import pytest

from app.ai import analyze_sentiment, analyze_speech
from app.ai.deepgram import _build_full_text, _map_segments, _mock_transcript

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


def test_build_full_text_joins_segments():
    text = _build_full_text([{"text": "First."}, {"text": "Second."}, {"text": ""}])
    assert text == "First.\n\nSecond."


def test_mock_transcript_shape():
    result = _mock_transcript()
    assert result["full_text"]
    assert result["segments"]
    assert len(result["speakers"]) >= 2
    assert result["mock"] is True


# --- Speech analysis --------------------------------------------------------


def test_speech_metrics_derived_from_segments():
    speech = run(
        analyze_speech(
            {"segments": SEGMENTS, "duration": 12.0},
            mock=False,
        )
    )
    assert speech["speech_speed_wpm"] > 0
    assert 0 <= speech["confidence"] <= 100
    assert 0 <= speech["clarity"] <= 100
    assert 0 <= speech["fluency"] <= 100
    assert 0 <= speech["energy"] <= 100
    assert speech["speaking_rate"] > 0
    assert isinstance(speech["total_pauses"], int)


def test_speech_analysis_mock_mode():
    speech = run(analyze_speech(mock=True))
    assert speech["speech_speed_wpm"] == 148.0
    assert speech["tone"] == "Professional"


def test_speech_analysis_no_segments_falls_back_to_mock():
    speech = run(analyze_speech({"segments": []}, mock=False))
    assert speech["speech_speed_wpm"] == 148.0


# --- Sentiment analysis -----------------------------------------------------


def test_sentiment_positive_text():
    text = (
        "I successfully delivered a scalable system and I am proud of the "
        "teamwork and the positive results we achieved."
    )
    result = run(analyze_sentiment({"full_text": text}, mock=False))
    assert result["sentiment"] in ("Positive", "Neutral")
    assert 0 <= result["confidence"] <= 100
    assert 0 <= result["professionalism"] <= 100
    assert result["summary"]


def test_sentiment_empty_text_returns_neutral():
    result = run(analyze_sentiment({"full_text": ""}, mock=False))
    assert result["sentiment"] == "Neutral"
    assert result["emotion"] == "Neutral"


def test_sentiment_mock_mode():
    result = run(analyze_sentiment(mock=True))
    assert result["sentiment"] == "Positive"
