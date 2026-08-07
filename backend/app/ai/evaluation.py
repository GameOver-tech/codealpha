"""LLM evaluation — evaluates ONLY the Deepgram transcript.

The LLM receives a strictly limited payload: candidate name, the Deepgram
transcript, segments, duration, language, and speakers. It is explicitly
forbidden from inventing, rewriting, or expanding the transcript — it may
only analyze what actually exists.

If the transcript is too short to evaluate meaningfully, a deterministic
"insufficient content" evaluation is produced instead of calling the LLM.
"""
from __future__ import annotations

from typing import Any

from app.ai.base import with_retries
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

# The 10 selectable evaluation criteria — canonical order. Each maps 1:1 to a
# score key and a column on InterviewScores.
CRITERIA = SCORE_KEYS[:-1]

CRITERION_LABELS = {
    "technical_skills": "Technical",
    "communication": "Communication",
    "confidence": "Confidence",
    "problem_solving": "Problem Solving",
    "relevant_experience": "Experience",
    "leadership": "Leadership",
    "teamwork": "Teamwork",
    "critical_thinking": "Critical Thinking",
    "behavior": "Behavior",
    "professionalism": "Professionalism",
}

CRITERION_DESCRIPTIONS = {
    "technical_skills": "accuracy, depth, and relevance of technical responses.",
    "communication": "clarity, structure, articulation.",
    "confidence": "inferred from language patterns (hedging, filler words, directness).",
    "problem_solving": "reasoning process, structured approach, edge-case awareness.",
    "relevant_experience": "match between the candidate's background and the job.",
    "leadership": "examples of ownership, direction, and influence.",
    "teamwork": "evidence of collaboration and working with others.",
    "critical_thinking": "trade-off analysis and depth of reasoning.",
    "behavior": "professionalism of conduct and responsiveness.",
    "professionalism": "overall professional tone and presentation.",
}


def _resolve_criteria(llm_input: dict[str, Any]) -> list[str]:
    """Return the criteria to evaluate for this interview.

    Empty/absent selection means evaluate all 10 (backward compatible). Only
    valid keys are kept, in canonical order, deduplicated.
    """
    selected = llm_input.get("evaluation_criteria") or []
    if not isinstance(selected, (list, tuple)):
        selected = []
    wanted = {str(s) for s in selected}
    resolved = [k for k in CRITERIA if k in wanted]
    return resolved or list(CRITERIA)


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

MIN_EVALUABLE_CHARS = 80  # below this the transcript is treated as greetings/insufficient

INSUFFICIENT_CONTENT_MSG = "Insufficient interview content for evaluation."


def _build_prompt(llm_input: dict[str, Any]) -> str:
    """Assemble the evaluation prompt from the restricted LLM input.

    The transcript is embedded exactly as received from Deepgram. The prompt
    forbids inventing questions, answers, or content of any kind. Only the
    selected evaluation criteria are scored and discussed.
    """
    transcript = llm_input["transcript"]
    criteria = _resolve_criteria(llm_input)
    criteria_labels = [CRITERION_LABELS.get(k, k.replace("_", " ").title()) for k in criteria]
    criteria_list = ", ".join(criteria_labels)

    rubric_lines = "\n".join(
        f"{i}. {key} — {CRITERION_DESCRIPTIONS.get(key, '')}"
        for i, key in enumerate(criteria, start=1)
    )
    scores_schema = ", ".join(f'"{key}": 0' for key in criteria) + ', "overall_score": 0'

    return f"""You are an expert technical interviewer and talent evaluator. You will analyze a REAL interview transcript produced by an automatic speech recognition system (Deepgram).

## STRICT RULES — READ CAREFULLY
1. Analyze ONLY the transcript below. Never invent, rewrite, expand, or replace it.
2. Never fabricate questions, answers, or details the candidate did not say.
3. Never add information that is not present. If the transcript contains only greetings or is too short to evaluate, say so explicitly.
4. Base every score, strength, weakness, and recommendation strictly on what the candidate actually said.
5. If the transcript has no substantive interview content, every field must reflect that — use the phrase "{INSUFFICIENT_CONTENT_MSG}" where appropriate and score conservatively.

## Candidate
- Name: {llm_input.get("candidate_name") or "Candidate"}

## Evaluation Criteria
The recruiter selected ONLY these competencies to evaluate:
{criteria_list}

Do NOT score or discuss competencies outside this list.

## Transcript (verbatim from Deepgram — do not alter)
{transcript}

## Metadata
- Duration: {llm_input.get("duration") or "unknown"}
- Language: {llm_input.get("language") or "unknown"}
- Detected speakers: {", ".join(llm_input.get("speakers") or []) or "unknown"}

## Scoring Rubric
Score each of these {len(criteria)} dimensions from 0 to 100, based ONLY on the transcript:
{rubric_lines}

The overall_score is the average of the selected dimensions ({criteria_list}), out of 100.

## Hiring Recommendation
Pick exactly one of these three verdicts:
- "Recommended" — overall_score >= {settings.SCORE_THRESHOLD_RECOMMENDED}
- "Need Further Review" — overall_score >= {settings.SCORE_THRESHOLD_NEEDS_REVIEW} and < {settings.SCORE_THRESHOLD_RECOMMENDED}
- "Not Recommended" — overall_score < {settings.SCORE_THRESHOLD_NEEDS_REVIEW}

## Output Format
Return ONLY valid JSON — no preamble, no markdown fences. Use this exact schema:
{{
  "scores": {{
    {scores_schema}
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
The "technical_evaluation", "report", "strengths", and "weaknesses" must focus ONLY on the selected competencies ({criteria_list}). Strengths and weaknesses must be 3-5 concise bullets grounded in specific things the candidate said. Every string field must be substantive (no empty strings)."""


def _validate_evaluation(data: dict[str, Any], llm_input: dict[str, Any]) -> dict[str, Any]:
    """Normalize and validate the parsed LLM payload.

    Only the selected evaluation criteria are kept as live scores. The
    overall_score is recomputed server-side as the average of the selected
    dimensions so it never depends on the LLM's own arithmetic.
    """
    criteria = _resolve_criteria(llm_input)
    score_keys = [*criteria, "overall_score"]

    scores = data.get("scores") or {}
    if not isinstance(scores, dict):
        raise BadRequestError("LLM evaluation missing 'scores' object")

    normalized_scores: dict[str, float] = {}
    for key in score_keys:
        raw = scores.get(key, 0)
        try:
            normalized_scores[key] = float(clamp_score(raw))
        except (TypeError, ValueError):
            normalized_scores[key] = 0.0

    # Deterministic overall score = average of the selected dimensions only.
    # If the LLM supplied no usable dimension scores (all 0/missing), fall
    # back to the LLM's own overall so threshold verdicts stay meaningful.
    if criteria:
        dims = [normalized_scores[k] for k in criteria]
        if any(d > 0 for d in dims):
            normalized_scores["overall_score"] = round(sum(dims) / len(criteria), 1)

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


def insufficient_content_evaluation() -> dict[str, Any]:
    """Deterministic evaluation for transcripts with no substantive content.

    Used when the Deepgram transcript is too short to evaluate (e.g. only
    greetings). The LLM is never asked to invent content.
    """
    empty_tech = {key: "" for key in TECHNICAL_EVAL_KEYS}
    empty_tech["overall_performance"] = INSUFFICIENT_CONTENT_MSG
    empty_report = {key: "" for key in REPORT_KEYS}
    empty_report["executive_summary"] = INSUFFICIENT_CONTENT_MSG
    empty_report["interview_overview"] = INSUFFICIENT_CONTENT_MSG
    empty_report["candidate_overview"] = INSUFFICIENT_CONTENT_MSG
    empty_report["performance_analysis"] = INSUFFICIENT_CONTENT_MSG

    return {
        "scores": {key: 0.0 for key in SCORE_KEYS},
        "technical_evaluation": empty_tech,
        "strengths": [],
        "weaknesses": [],
        "report": empty_report,
        "recommendation": {
            "verdict": "Need Further Review",
            "reason": INSUFFICIENT_CONTENT_MSG,
        },
    }


async def evaluate_transcript(llm_input: dict[str, Any]) -> dict[str, Any]:
    """Evaluate the Deepgram transcript with the configured LLM provider.

    Args:
        llm_input: restricted payload containing ONLY:
            candidate_name, transcript, segments, duration, language, speakers.

    Returns the validated evaluation payload. Raises BadRequestError when
    the LLM call fails.
    """
    transcript_text = (llm_input.get("transcript") or "").strip()
    if not transcript_text:
        raise BadRequestError("Cannot evaluate an empty transcript.")

    # Insufficient content — skip the LLM entirely, never fabricate.
    if len(transcript_text) < MIN_EVALUABLE_CHARS:
        logger.info(
            "Transcript too short (%s chars) — insufficient content evaluation",
            len(transcript_text),
        )
        return insufficient_content_evaluation()

    prompt = _build_prompt(llm_input)
    logger.info("LLM input preview: %s", prompt[:300])

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
        logger.info("LLM output preview: %s", raw[:300])
        parsed = extract_json(raw)
        return _validate_evaluation(parsed, llm_input)
    except BadRequestError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("LLM evaluation failed")
        raise BadRequestError(f"LLM evaluation failed: {exc}") from exc
