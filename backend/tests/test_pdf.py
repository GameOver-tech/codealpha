"""Tests for recommendation UI messages and the PDF builder."""
from pathlib import Path

from app.models.recommendation import RecommendationVerdict
from app.services.pdf_service import (
    _build_pdf_bytes,
    _duration_from_raw,
    _format_duration,
    _safe,
)
from app.utils.helpers import duration_from_segments
from app.utils.recommendation_messages import (
    RECOMMENDATION_MESSAGES,
    get_recommendation_message,
)

EVALUATION_PAYLOAD = {
    "scores": {
        "technical_skills": 86,
        "communication": 80,
        "confidence": 78,
        "problem_solving": 88,
        "relevant_experience": 84,
        "leadership": 72,
        "teamwork": 75,
        "critical_thinking": 82,
        "behavior": 79,
        "professionalism": 83,
        "overall_score": 81,
    },
    "report": {
        "executive_summary": "The candidate demonstrated strong backend engineering skills.",
        "interview_overview": "A structured technical interview.",
        "candidate_overview": "Five years of Python backend experience.",
        "performance_analysis": "Strong across the board.",
        "technical_assessment": "Advanced understanding of backend systems.",
        "communication_assessment": "Clear and structured.",
        "confidence_assessment": "Confident delivery.",
        "problem_solving_assessment": "Excellent.",
        "experience_assessment": "Relevant and hands-on.",
        "improvement_suggestions": "Quantify impact with more metrics.",
    },
    "strengths": [
        "Strong backend architecture experience",
        "Excellent problem-solving approach",
    ],
    "weaknesses": [
        "Could provide more specific metrics",
    ],
    "recommendation": {
        "verdict": "Recommended",
        "reason": "Performance met all hiring criteria.",
    },
}


# --- Recommendation messages (exact copy per spec) --------------------------


def test_recommended_message():
    msg = get_recommendation_message("Recommended")
    assert "Congratulations!" in msg
    assert "passed the AI interview evaluation" in msg
    assert "Best of luck!" in msg


def test_not_recommended_message():
    msg = get_recommendation_message("Not Recommended")
    assert "Thank you for participating" in msg
    assert "did not meet our current hiring requirements" in msg
    assert "We wish you success in your career." in msg


def test_need_further_review_message():
    msg = get_recommendation_message("Need Further Review")
    assert "requires additional review" in msg
    assert "Thank you for your patience." in msg


def test_all_three_verdicts_have_messages():
    assert set(RECOMMENDATION_MESSAGES) == {
        "Recommended",
        "Not Recommended",
        "Need Further Review",
    }


# --- PDF generation ---------------------------------------------------------


def test_pdf_builds_valid_document():
    payload = {
        "candidate_name": "Alice Johnson",
        "candidate_email": "alice@example.com",
        "interview_date": "2026-07-30T10:00:00",
        "duration_seconds": 2315,
        "overall_score": EVALUATION_PAYLOAD["scores"]["overall_score"],
        "recommendation": EVALUATION_PAYLOAD["recommendation"]["verdict"],
        "recommendation_reason": EVALUATION_PAYLOAD["recommendation"]["reason"],
        "transcript": "Interviewer: Thank you for joining us.\nCandidate: I have five years of experience.",
        "scores": EVALUATION_PAYLOAD["scores"],
        "report": EVALUATION_PAYLOAD["report"],
        "strengths": EVALUATION_PAYLOAD["strengths"],
        "weaknesses": EVALUATION_PAYLOAD["weaknesses"],
    }
    pdf = _build_pdf_bytes(payload)
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 1000


def test_pdf_builds_with_empty_data():
    """The PDF must not crash on an interview with no artifacts yet."""
    payload = {
        "candidate_name": "",
        "candidate_email": "",
        "interview_date": None,
        "duration_seconds": 0,
        "overall_score": 0,
        "recommendation": "",
        "recommendation_reason": "",
        "transcript": "",
        "scores": {},
        "report": {},
        "strengths": [],
        "weaknesses": [],
    }
    pdf = _build_pdf_bytes(payload)
    assert pdf[:4] == b"%PDF"


# --- Verdict normalization (Issue: enum names must never reach users) -------


def test_safe_normalizes_verdict_enum_to_human_label():
    assert _safe(RecommendationVerdict.RECOMMENDED) == "Recommended"
    assert _safe(RecommendationVerdict.NOT_RECOMMENDED) == "Not Recommended"
    assert _safe(RecommendationVerdict.NEED_FURTHER_REVIEW) == "Need Further Review"


def test_pdf_never_contains_enum_class_name():
    """The PDF bytes must not contain RecommendationVerdict.* anywhere."""
    payload = {
        "candidate_name": "Alice Johnson",
        "candidate_email": "alice@example.com",
        "interview_date": "2026-07-30T10:00:00",
        "duration_seconds": 134,
        "overall_score": 81,
        "recommendation": RecommendationVerdict.RECOMMENDED,
        "recommendation_reason": "Strong performance.",
        "transcript": "",
        "scores": EVALUATION_PAYLOAD["scores"],
        "report": EVALUATION_PAYLOAD["report"],
        "strengths": EVALUATION_PAYLOAD["strengths"],
        "weaknesses": EVALUATION_PAYLOAD["weaknesses"],
    }
    pdf = _build_pdf_bytes(payload)
    assert b"RecommendationVerdict" not in pdf


def test_pdf_builds_with_recommendation_enum_verdict():
    """Passing the raw enum (as the DB relationship yields) must not crash."""
    payload = {
        "candidate_name": "Alice Johnson",
        "candidate_email": "alice@example.com",
        "interview_date": "2026-07-30T10:00:00",
        "duration_seconds": 134,
        "overall_score": 81,
        "recommendation": RecommendationVerdict.NOT_RECOMMENDED,
        "recommendation_reason": "Below threshold.",
        "transcript": "",
        "scores": EVALUATION_PAYLOAD["scores"],
        "report": EVALUATION_PAYLOAD["report"],
        "strengths": EVALUATION_PAYLOAD["strengths"],
        "weaknesses": EVALUATION_PAYLOAD["weaknesses"],
    }
    pdf = _build_pdf_bytes(payload)
    assert pdf[:4] == b"%PDF"


# --- Duration formatting ----------------------------------------------------


def test_format_duration_covers_required_shapes():
    assert _format_duration(0) == "0m 00s"
    assert _format_duration(134) == "2m 14s"
    assert _format_duration(932) == "15m 32s"
    assert _format_duration(1908) == "31m 48s"
    assert _format_duration(3912) == "1h 05m 12s"


# --- Duration derived from transcript timestamps -----------------------------


def test_duration_from_segments_uses_last_segment_end():
    """The interview duration is the last segment's end time."""
    segments = [
        {"start": 0.0, "end": 8.4, "text": "Hello.", "speaker": "A"},
        {"start": 8.9, "end": 45.2, "text": "Intro.", "speaker": "B"},
        {"start": 46.0, "end": 1845.2, "text": "Long answer.", "speaker": "B"},
        {"start": 1845.2, "end": 1912.6, "text": "Closing.", "speaker": "A"},
    ]
    assert duration_from_segments(segments) == 1913  # round(1912.6)
    assert _format_duration(duration_from_segments(segments)) == "31m 53s"


def test_duration_from_segments_hour_scale():
    segments = [{"start": 0.0, "end": 4338.2, "text": "x", "speaker": "A"}]
    assert _format_duration(duration_from_segments(segments)) == "1h 12m 18s"


def test_duration_from_segments_tolerates_bad_data():
    assert duration_from_segments([]) == 0
    assert duration_from_segments(None) == 0
    assert duration_from_segments([{"start": 0, "text": "no end"}]) == 0
    assert duration_from_segments(["not-a-dict"]) == 0
    assert duration_from_segments([{"start": 0, "end": "not-a-number", "text": "x"}]) == 0


def test_duration_from_raw_response():
    raw = {"metadata": {"duration": 1912.6}}
    assert _duration_from_raw(raw) == 1913
    assert _duration_from_raw({}) == 0
    assert _duration_from_raw(None) == 0
