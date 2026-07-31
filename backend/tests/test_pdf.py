"""Tests for recommendation UI messages and the PDF builder."""
from pathlib import Path

from app.services.pdf_service import _build_pdf_bytes
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
