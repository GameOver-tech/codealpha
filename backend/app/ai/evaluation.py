"""LLM evaluation — prompts the configured provider to evaluate an interview.

Builds a strict-JSON prompt covering all 10 score dimensions, 16 technical
evaluation areas, strengths, weaknesses, a full report, and the hiring
recommendation. Parses and validates the provider's response.
"""
from __future__ import annotations

import json
from typing import Any

from app.ai.base import with_retries
from app.ai.providers import MockProvider
from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError
from app.utils.parsing import clamp_score, extract_json, split_bullets

logger = get_logger(__name__)

SCORE_KEYS = [
    "technical_skills", "communication", "confidence", "problem_solving",
    "relevant_experience", "leadership", "teamwork", "critical_thinking",
    "behavior", "professionalism", "overall_score",
]

TECHNICAL_EVAL_KEYS = [
    "technical_knowledge", "communication_skills", "confidence_level",
    "problem_solving", "relevant_experience", "leadership", "teamwork",
    "critical_thinking", "behavior", "professionalism", "answer_quality",
    "answer_accuracy", "depth_of_knowledge", "domain_expertise",
    "soft_skills", "overall_performance",
]

REPORT_KEYS = [
    "executive_summary", "interview_overview", "candidate_overview",
    "performance_analysis", "technical_assessment", "communication_assessment",
    "confidence_assessment", "problem_solving_assessment",
    "experience_assessment", "improvement_suggestions",
]

VALID_VERDICTS = {"Recommended", "Not Recommended", "Need Further Review"}


def _build_prompt(
    job_title: str,
    job_description: str,
    transcript: str,
    speech_metrics: dict[str, Any] | None = None,
    sentiment: dict[str, Any] | None = None,
) -> str:
    """Assemble the evaluation prompt for the LLM provider."""
    speech_block = ""
    if speech_metrics:
        speech_block = f"""
## Speech Signals (from prosodic analysis)
- Speech speed: {speech_metrics.get('speech_speed_wpm', 'N/A')} WPM
- Speaking rate: {speech_metrics.get('speaking_rate', 'N/A')} words/sec
- Pauses: {speech_metrics.get('total_pauses', 'N/A')} (avg {speech_metrics.get('avg_pause_seconds', 'N/A')}s)
- Confidence signal: {speech_metrics.get('confidence', 'N/A')}/100
- Clarity: {speech_metrics.get('clarity', 'N/A')}/100
- Fluency: {speech_metrics.get('fluency', 'N/A')}/100
- Energy: {speech_metrics.get('energy', 'N/A')}/100
- Tone: {speech_metrics.get('tone', 'N/A')}
- Emotion: {speech_metrics.get('emotion', 'N/A')}
"""

    sentiment_block = ""
    if sentiment:
        sentiment_block = f"""
## Sentiment Signals
- Overall sentiment: {sentiment.get('sentiment', 'N/A')}
- Emotion: {sentiment.get('emotion', 'N/A')}
- Professionalism: {sentiment.get('professionalism', 'N/A')}/100
"""

    recommended_threshold = settings.SCORE_THRESHOLD_RECOMMENDED
    needs_review_threshold = settings.SCORE_THRESHOLD_NEEDS_REVIEW

    return f"""You are an expert technical interviewer and talent evaluator at a technology company. Analyze the interview transcript below and produce a detailed, objective candidate evaluation.

## Job Context
Title: {job_title}
Description: {job_description}
{speech_block}
{sentiment_block}
## Transcript
{transcript}

## Scoring Rubric
Score each of these 10 dimensions from 0 to 100:
1. technical_skills — accuracy, depth, and relevance of technical responses.
2. communication — clarity, structure, articulation.
3. confidence — inferred from speech patterns and language (hedging, filler words, directness).
4. problem_solving — reasoning process, structured approach, edge-case awareness.
5. relevant_experience — match between the candidate's background and the job.
6. leadership — examples of ownership, direction, and influence.
7. teamwork — evidence of collaboration and working with others.
8. critical_thinking — trade-off analysis and depth of reasoning.
9. behavior — professionalism of conduct and responsiveness.
10. professionalism — overall professional tone and presentation.

The overall_score is the weighted average of all 10 dimensions (out of 100).

## Hiring Recommendation
Pick exactly one of these three verdicts:
- "Recommended" — overall_score >= {recommended_threshold}
- "Need Further Review" — overall_score >= {needs_review_threshold} and < {recommended_threshold}
- "Not Recommended" — overall_score < {needs_review_threshold}

## Output Format
Return ONLY valid JSON — no preamble, no markdown fences. Use this exact schema:
{{
  "scores": {{
    "technical_skills": 0, "communication": 0, "confidence": 0, "problem_solving": 0,
    "relevant_experience": 0, "leadership": 0, "teamwork": 0, "critical_thinking": 0,
    "behavior": 0, "professionalism": 0, "overall_score": 0
  }},
  "technical_evaluation": {{
    "technical_knowledge": "...", "communication_skills": "...", "confidence_level": "...",
    "problem_solving": "...", "relevant_experience": "...", "leadership": "...",
    "teamwork": "...", "critical_thinking": "...", "behavior": "...", "professionalism": "...",
    "answer_quality": "...", "answer_accuracy": "...", "depth_of_knowledge": "...",
    "domain_expertise": "...", "soft_skills": "...", "overall_performance": "..."
  }},
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "report": {{
    "executive_summary": "...", "interview_overview": "...", "candidate_overview": "...",
    "performance_analysis": "...", "technical_assessment": "...", "communication_assessment": "...",
    "confidence_assessment": "...", "problem_solving_assessment": "...",
    "experience_assessment": "...", "improvement_suggestions": "..."
  }},
  "recommendation": {{
    "verdict": "Recommended",
    "reason": "..."
  }}
}}
Strengths and weaknesses must be 3-5 concise bullets grounded in specific things the candidate said. Every string field must be substantive (no empty strings)."""


def _validate_evaluation(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize and validate the parsed LLM payload."""
    scores = data.get("scores") or {}
    if not isinstance(scores, dict):
        raise BadRequestError("LLM evaluation missing 'scores' object")

    normalized_scores: dict[str, float] = {}
    for key in SCORE_KEYS:
        raw = scores.get(key, 0)
        try:
            normalized_scores[key] = float(clamp_score(raw))
        except (TypeError, ValueError):
            normalized_scores[key] = 0.0

    tech = data.get("technical_evaluation") or {}
    if not isinstance(tech, dict):
        tech = {}
    normalized_tech: dict[str, str] = {}
    for key in TECHNICAL_EVAL_KEYS:
        value = tech.get(key, "")
        normalized_tech[key] = str(value).strip() if isinstance(value, str) else str(value)

    strengths = split_bullets(data.get("strengths") or [])
    weaknesses = split_bullets(data.get("weaknesses") or [])

    report = data.get("report") or {}
    if not isinstance(report, dict):
        report = {}
    normalized_report: dict[str, str] = {}
    for key in REPORT_KEYS:
        value = report.get(key, "")
        normalized_report[key] = str(value).strip() if isinstance(value, str) else str(value)

    rec = data.get("recommendation") or {}
    if not isinstance(rec, dict):
        rec = {}
    verdict = str(rec.get("verdict", "")).strip()
    if verdict not in VALID_VERDICTS:
        # Fall back to threshold-based decision if the LLM returned something invalid.
        overall = normalized_scores["overall_score"]
        if overall >= settings.SCORE_THRESHOLD_RECOMMENDED:
            verdict = "Recommended"
        elif overall >= settings.SCORE_THRESHOLD_NEEDS_REVIEW:
            verdict = "Need Further Review"
        else:
            verdict = "Not Recommended"
    reason = str(rec.get("reason", "")).strip() or "Recommendation generated by AI evaluation."

    return {
        "scores": normalized_scores,
        "technical_evaluation": normalized_tech,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "report": normalized_report,
        "recommendation": {"verdict": verdict, "reason": reason},
    }


async def evaluate_transcript(
    job_title: str,
    job_description: str,
    transcript_text: str,
    *,
    speech_metrics: dict[str, Any] | None = None,
    sentiment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run the full LLM evaluation for a transcript. Returns the validated payload."""
    prompt = _build_prompt(
        job_title, job_description, transcript_text, speech_metrics, sentiment
    )

    provider = MockProvider() if settings.USE_MOCK_AI else None
    if provider is None:
        from app.ai import get_llm_provider

        provider = get_llm_provider()

    async def _call() -> str:
        return await provider.complete(
            prompt,
            max_tokens=settings.LLM_MAX_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
        )

    try:
        raw = await with_retries(_call)
        parsed = extract_json(raw)
        return _validate_evaluation(parsed)
    except BadRequestError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("LLM evaluation failed")
        raise BadRequestError(f"LLM evaluation failed: {exc}") from exc
