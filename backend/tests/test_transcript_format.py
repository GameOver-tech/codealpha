"""Tests for the transcript formatting helpers (executive summary + Q&A).

The executive summary feeds the "Interview Summary" section of the PDF; the
Q&A helpers remain unit-testable even though the PDF no longer embeds the
full transcript.
"""
from app.services.transcript_format import (
    build_interview_summary,
    build_qa_pairs,
    format_qa_transcript,
)

REPORT = {
    "executive_summary": (
        "The candidate is a strong backend engineer with deep Python experience and "
        "communicated clearly throughout. The interview covered system design, database "
        "modeling, and API architecture in depth, and the overall performance was strong."
    ),
    "interview_overview": (
        "The session focused on backend engineering fundamentals, scalable system design, "
        "and behavioral questions around teamwork and ownership."
    ),
    "performance_analysis": (
        "Consistently strong across all dimensions, with particular depth in distributed "
        "systems and database performance tuning."
    ),
    "technical_assessment": (
        "Advanced understanding of PostgreSQL indexing, async frameworks, and microservices "
        "architecture. The candidate articulated trade-offs convincingly with real examples."
    ),
    "communication_assessment": (
        "Excellent communication skills. Responses were structured and concise, and technical "
        "jargon was explained clearly for non-technical stakeholders."
    ),
    "confidence_assessment": (
        "High confidence throughout, comfortable defending technical decisions with data while "
        "staying open to alternative viewpoints."
    ),
    "problem_solving_assessment": (
        "Very good analytical thinking. Approached the design problem methodically and evaluated "
        "multiple solutions before committing to a pragmatic recommendation."
    ),
    "experience_assessment": (
        "Relevant hands-on experience building and scaling payment APIs handling millions of "
        "requests daily, including incident response and capacity planning."
    ),
    "improvement_suggestions": (
        "Needs improvement in Pakistan economy fundamentals and would benefit from deeper "
        "exposure to infrastructure-as-code tooling such as Terraform."
    ),
}


# --- Executive summary -----------------------------------------------------


def test_summary_covers_all_required_aspects():
    findings = build_interview_summary(REPORT)
    labels = [label for label, _ in findings]
    for expected in (
        "Overall Impression",
        "Topics Discussed",
        "Technical Knowledge",
        "Communication Style",
        "Confidence Level",
        "Critical Thinking & Problem Solving",
        "Relevant Experience",
        "Areas for Improvement",
    ):
        assert expected in labels


def test_summary_within_word_budget():
    findings = build_interview_summary(REPORT)
    total = sum(len(text.split()) for _, text in findings)
    # Never exceed the hard budget; a fully-populated report should approach it.
    assert total <= 250
    assert total >= 120


def test_summary_is_not_transcript():
    findings = build_interview_summary(REPORT)
    joined = " ".join(text for _, text in findings)
    assert "Interviewer:" not in joined
    assert "Candidate:" not in joined
    assert "Question 1" not in joined


def test_summary_fallback_on_empty_report():
    findings = build_interview_summary({})
    assert len(findings) == 1
    assert findings[0][1] == "Interview summary is not available for this evaluation."


def test_summary_does_not_duplicate_fallback_text():
    # A sparse report must not repeat the same sentence under multiple labels.
    findings = build_interview_summary({"executive_summary": "A decent candidate."})
    texts = [text for _, text in findings]
    assert len(set(texts)) == len(texts)


# --- Q&A helpers (still available, no longer embedded in the PDF) ----------


def test_build_qa_pairs_groups_turns():
    segments = [
        {"start": 0.0, "end": 3.0, "text": "Tell me about yourself.", "speaker": "Interviewer"},
        {"start": 3.2, "end": 9.0, "text": "I build APIs in Python for the last five years.", "speaker": "Candidate"},
        {"start": 9.5, "end": 12.0, "text": "What stack do you prefer?", "speaker": "Interviewer"},
        {"start": 12.5, "end": 18.0, "text": "FastAPI and PostgreSQL, which I have used in production for years.", "speaker": "Candidate"},
    ]
    pairs = build_qa_pairs(segments)
    assert len(pairs) == 2
    assert pairs[0]["question"].startswith("Tell me about yourself")
    assert pairs[0]["answer"].startswith("I build APIs")
    assert pairs[1]["question"].startswith("What stack do you prefer")
    assert pairs[1]["answer"].startswith("FastAPI and PostgreSQL")


def test_format_qa_transcript_renders_blocks():
    segments = [
        {"start": 0.0, "end": 3.0, "text": "Question one.", "speaker": "Interviewer"},
        {"start": 3.2, "end": 9.0, "text": "A detailed answer with more words.", "speaker": "Candidate"},
    ]
    text = format_qa_transcript(segments)
    assert "Question 1" in text
    assert "Interviewer:" in text
    assert "Candidate:" in text


def test_format_qa_transcript_single_speaker_fallback():
    segments = [{"start": 0.0, "end": 4.0, "text": "Only one speaker here.", "speaker": "A"}]
    assert format_qa_transcript(segments) == "Only one speaker here."
