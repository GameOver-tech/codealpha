"""Tests for LLM evaluation validation, JSON parsing, and file validation."""
import asyncio

import pytest

from app.ai.evaluation import _validate_evaluation
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
