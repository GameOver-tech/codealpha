"""Sentiment analysis — tone/emotion/professionalism of the interview.

Uses a lexicon-based classifier over the transcript text (fast, free, and
deterministic) so no external API is required. In mock mode it returns a
fixed realistic response.
"""
from __future__ import annotations

import re
from typing import Any

POSITIVE_WORDS = {
    "excellent", "great", "strong", "confident", "success", "successful",
    "improved", "improvement", "solved", "solution", "achieved", "delivered",
    "love", "enjoy", "passion", "proactive", "collaborative", "teamwork",
    "efficient", "optimized", "reduced", "contribute", "contribution",
    "pleased", "proud", "helpful", "robust", "scalable", "reliable",
    "effectively", "seamlessly", "well", "good", "best", "better",
    "positive", "beneficial", "innovation", "innovative", "leader",
}
NEGATIVE_WORDS = {
    "unfortunately", "failed", "failure", "problem", "problems", "difficult",
    "struggled", "struggle", "issue", "issues", "bug", "bugs", "error",
    "errors", "slow", "painful", "bad", "worse", "worst", "lack", "lacking",
    "unable", "cannot", "can't", "worried", "concern", "concerns", "stress",
    "stressful", "disappointed", "mistake", "mistakes", "regret", "delay",
}


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9\s']", " ", text.lower())


def _analyze_lexicon(text: str) -> dict[str, Any]:
    words = set(_normalize(text).split())
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        polarity = 0.5
        sentiment = "Neutral"
    else:
        polarity = pos / total
        if polarity >= 0.6:
            sentiment = "Positive"
        elif polarity <= 0.4:
            sentiment = "Negative"
        else:
            sentiment = "Neutral"

    confidence = round(50.0 + abs(polarity - 0.5) * 90.0, 1)
    if sentiment == "Positive":
        emotion = "Confident" if confidence >= 75 else "Positive"
    elif sentiment == "Negative":
        emotion = "Concerned" if confidence >= 75 else "Neutral"
    else:
        emotion = "Neutral"

    professionalism = round(65.0 + pos * 4.0 - neg * 3.0, 1)
    professionalism = max(0.0, min(100.0, professionalism))

    summary = (
        f"The conversation has an overall {sentiment.lower()} tone "
        f"({confidence:.0f}% confidence), with {pos} positive and {neg} negative "
        f"sentiment markers detected. The candidate came across as {emotion.lower()} "
        f"and professional throughout."
    )
    return {
        "sentiment": sentiment,
        "emotion": emotion,
        "confidence": confidence,
        "professionalism": professionalism,
        "summary": summary,
    }


async def analyze_sentiment(
    transcript: dict[str, Any] | None = None, *, mock: bool = False
) -> dict[str, Any]:
    """Analyze the sentiment of an interview transcript.

    Args:
        transcript: dict with "full_text" (or "segments").
        mock: force the deterministic mock response (mock mode).
    """
    if mock:
        return {
            "sentiment": "Positive",
            "emotion": "Confident",
            "confidence": 84.0,
            "professionalism": 88.0,
            "summary": "The candidate demonstrated a positive and confident tone with professional communication throughout the interview.",
        }

    text = transcript.get("full_text") if transcript else ""
    if not text and transcript and transcript.get("segments"):
        text = " ".join(seg.get("text", "") for seg in transcript["segments"])
    if not text:
        return {
            "sentiment": "Neutral",
            "emotion": "Neutral",
            "confidence": 50.0,
            "professionalism": 70.0,
            "summary": "Insufficient transcript content for sentiment analysis.",
        }
    return _analyze_lexicon(text)
