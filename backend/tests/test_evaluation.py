"""Tests for LLM evaluation validation, JSON parsing, and file validation."""
import asyncio

import pytest

from app.ai.evaluation import (
    _validate_evaluation,
    _build_prompt,
    insufficient_content_evaluation,
    INSUFFICIENT_CONTENT_MSG,
)
from app.utils.parsing import clamp_score, extract_json, split_bullets
from app.utils.file_validation import get_file_extension


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


# --- Parsing helpers --------------------------------------------------------


def test_extract_json_from_fenced_block():
    raw = "```json\n{\"scores\": {\"overall_score\": 81}}\n```"
    assert extract_json(raw) == {"scores": {"overall_score": 81}}


def test_extract_json_with_trailing_prose():
    raw = 'Sure! Here is the result: {"verdict": "Recommended"}\nHope that helps.'
    assert extract_json(raw) == {"verdict": "Recommended"}


def test_extract_json_repairs_trailing_commas():
    raw = '{"a": 1, "b": 2,}'
    assert extract_json(raw) == {"a": 1, "b": 2}


def test_clamp_score_bounds():
    assert clamp_score(150) == 100
    assert clamp_score(-5) == 0
    assert clamp_score(87.6) == 88


def test_split_bullets_list_and_text():
    assert split_bullets([" a ", " b "]) == ["a", "b"]
    assert split_bullets("- one\n- two") == ["one", "two"]


# --- Evaluation validation --------------------------------------------------


def test_validate_evaluation_normalizes_scores():
    payload = {
        "scores": {"technical_skills": 95, "overall_score": "85"},
        "technical_evaluation": {},
        "strengths": ["Strong communication"],
        "weaknesses": [],
        "report": {"executive_summary": "Good candidate"},
        "recommendation": {"verdict": "Recommended", "reason": "Meets criteria"},
    }
    result = _validate_evaluation(payload)
    assert result["scores"]["technical_skills"] == 95.0
    assert result["scores"]["overall_score"] == 85.0
    # Missing score keys default to 0.
    assert result["scores"]["communication"] == 0.0
    assert result["strengths"] == ["Strong communication"]


def test_validate_evaluation_falls_back_to_threshold_verdict():
    payload = {
        "scores": {"overall_score": 90},
        "technical_evaluation": {},
        "strengths": [],
        "weaknesses": [],
        "report": {},
        "recommendation": {"verdict": "Not Sure"},
    }
    result = _validate_evaluation(payload)
    assert result["recommendation"]["verdict"] == "Recommended"


def test_validate_evaluation_low_score_verdict():
    payload = {
        "scores": {"overall_score": 20},
        "technical_evaluation": {},
        "strengths": [],
        "weaknesses": [],
        "report": {},
        "recommendation": {"verdict": ""},
    }
    result = _validate_evaluation(payload)
    assert result["recommendation"]["verdict"] == "Not Recommended"


# --- File validation --------------------------------------------------------


def test_file_extension():
    assert get_file_extension("interview.MP4") == ".mp4"
    assert get_file_extension("clip.mp3") == ".mp3"
    assert get_file_extension("") == ""


# --- Restricted LLM input ---------------------------------------------------


def test_build_prompt_embeds_transcript_verbatim():
    llm_input = {
        "candidate_name": "Alice",
        "transcript": "Interviewer: Tell me about yourself.\nCandidate: I build APIs.",
        "segments": [],
        "duration": "120s",
        "language": "en",
        "speakers": ["0", "1"],
    }
    prompt = _build_prompt(llm_input)
    assert "Interviewer: Tell me about yourself.\nCandidate: I build APIs." in prompt
    assert "Alice" in prompt
    assert "120s" in prompt
    assert "en" in prompt
    assert "Never invent, rewrite, expand, or replace it" in prompt


def test_build_prompt_contains_only_expected_inputs():
    """The prompt must not contain job context or speech/sentiment sections."""
    llm_input = {
        "candidate_name": "Alice",
        "transcript": "Some real transcript content here for the interview.",
        "segments": [],
        "duration": "120s",
        "language": "en",
        "speakers": ["0"],
    }
    prompt = _build_prompt(llm_input)
    assert "Job Context" not in prompt
    assert "Speech Signals" not in prompt
    assert "Sentiment Signals" not in prompt


def test_insufficient_content_evaluation():
    result = insufficient_content_evaluation()
    assert result["recommendation"]["verdict"] == "Need Further Review"
    assert result["recommendation"]["reason"] == INSUFFICIENT_CONTENT_MSG
    assert result["report"]["executive_summary"] == INSUFFICIENT_CONTENT_MSG
    assert result["scores"]["overall_score"] == 0.0


# --- Transcription failure contract -----------------------------------------


def test_transcription_error_500_contract():
    """TranscriptionError must map to the exact 500 JSON payload."""
    from fastapi.testclient import TestClient

    from app.main import app
    from app.utils.exceptions import TranscriptionError

    from fastapi import APIRouter

    probe = APIRouter()

    @probe.get("/probe/transcription-fail")
    async def fail():
        raise TranscriptionError("Deepgram returned an empty response.")

    app.include_router(probe)

    client = TestClient(app)
    resp = client.get("/probe/transcription-fail")
    assert resp.status_code == 500
    assert resp.json() == {
        "success": False,
        "message": "Transcription failed.",
        "reason": "Deepgram returned an empty response.",
    }
