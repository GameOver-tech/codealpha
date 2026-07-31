import json
import re

from app.core.config import settings

MOCK_EVALUATION = {
    "overall_score": 82,
    "recommendation": "Recommended",
    "technical_score": 85,
    "communication_score": 78,
    "confidence_score": 80,
    "problem_solving_score": 88,
    "experience_score": 80,
    "strengths": [
        "Strong backend architecture experience — designed and migrated a monolithic Django app to six microservices using the Saga pattern",
        "Excellent problem-solving approach — used EXPLAIN ANALYZE profiling and composite indexing to reduce query time from 30s to 200ms",
        "Solid understanding of distributed systems concepts — idempotency keys, compensating transactions, dead-letter queues",
        "Proactive about staying current — contributes to open source, attends PyCon, builds side projects with WebSockets",
    ],
    "weaknesses": [
        "Could provide more specific metrics on the scale and impact of the microservices migration",
        "Mentioned Redis caching but did not elaborate on cache invalidation strategy or edge cases like cache stampedes",
        "Did not discuss testing methodology or how quality was maintained during the migration",
    ],
    "summary": "The candidate demonstrates strong backend engineering skills with relevant experience in Python, FastAPI, and system design. Their hands-on work with the Saga pattern for microservices migration and their methodical approach to resolving a 30-second query performance issue show solid technical depth. Communication is clear and structured, though occasionally lacking specific impact metrics. Overall, the candidate is well-suited for a senior backend role and is recommended for hire.",
}


def _build_claude_prompt(
    job_title: str, job_description: str, transcript: str
) -> list[dict]:
    recommended_threshold = settings.SCORE_THRESHOLD_RECOMMENDED
    needs_review_threshold = settings.SCORE_THRESHOLD_NEEDS_REVIEW

    system_prompt = f"""You are an expert technical interviewer and talent evaluator at a technology company. Your job is to analyze interview transcripts and produce detailed, objective candidate evaluations.

## Job Context
Title: {job_title}
Description: {job_description}

## Transcript
{transcript}

## Evaluation Rubric
Score each of the following 5 dimensions from 0 to 100:

1. **Technical answers** — Accuracy, depth, and relevance of the candidate's technical responses. Assess whether they demonstrated genuine understanding or just surface-level familiarity.
2. **Communication skills** — Clarity of expression, logical structure of responses, articulation of complex ideas. Note if the candidate rambles, uses jargon without explanation, or explains concepts effectively.
3. **Confidence level** — Inferred from language patterns in the transcript. Look for hedging language ("I think", "maybe", "sort of"), filler words ("um", "like"), directness of delivery, and hesitation patterns. *Important: This is a textual proxy for confidence inferred from speech patterns, not a judgment about the candidate's actual emotional state or personality.*
4. **Problem-solving ability** — Reasoning process, structured approach to hypothetical or technical problems raised during the interview. Does the candidate break problems down, consider edge cases, or jump to conclusions?
5. **Relevant experience** — How well the candidate's past experience and projects match the requirements of this specific job.

## Overall Score & Recommendation

Derive the **overall_score** from the 5 dimension scores (use a weighted average — technical and problem-solving slightly weighted more than the others).

Based on the overall_score, pick exactly one of these three recommendations:
- "Recommended" — overall_score >= {recommended_threshold}
- "Needs Further Review" — overall_score >= {needs_review_threshold} and < {recommended_threshold}
- "Not Recommended" — overall_score < {needs_review_threshold}

## Strengths & Weaknesses
Provide 3-5 **concise, bullet-style** strengths and weaknesses. Each must be **grounded in specific things the candidate said** in the transcript — not generic platitudes. Format each as a short phrase that references the actual content.

## Summary
Write 3-4 sentences summarizing the candidate's fit, key takeaways from the evaluation, and whether they should advance in the process.

## Output Format
Return **ONLY valid JSON** — no preamble, no explanation, no markdown code fences. The JSON must match this exact schema:
{{
  "overall_score": 0,
  "recommendation": "Recommended",
  "technical_score": 0,
  "communication_score": 0,
  "confidence_score": 0,
  "problem_solving_score": 0,
  "experience_score": 0,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "summary": "..."
}}
"""

    return [
        {"role": "user", "content": system_prompt},
    ]


def _parse_evaluation_json(text: str) -> dict:
    """Defensively parse JSON from Claude's response — handles markdown fences."""
    # Strip markdown fences if present
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        # Remove closing fence
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    return json.loads(cleaned)


async def evaluate_transcript(
    job_title: str, job_description: str, transcript: str
) -> dict:
    """Evaluate a transcript using Claude API. Returns the evaluation dict.

    In mock mode (USE_MOCK_AI=true or missing CLAUDE_API_KEY), returns
    a hardcoded realistic evaluation.
    """
    if settings.mock_mode:
        import copy

        return copy.deepcopy(MOCK_EVALUATION)

    import anthropic

    client = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)
    messages = _build_claude_prompt(job_title, job_description, transcript)

    for attempt in range(2):  # retry once on parse failure
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=messages,
            )
            content = response.content[0].text
            return _parse_evaluation_json(content)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            if attempt == 1:
                raise RuntimeError(
                    f"Failed to parse Claude evaluation JSON after retry: {e}"
                )
            # Retry once
            continue
        except Exception:
            raise
