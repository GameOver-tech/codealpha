import httpx
import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

CLAUDE_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-sonnet-4-20250514"

EVALUATION_PROMPT = """You are an expert technical interviewer evaluating a candidate's interview transcript. Analyze the transcript carefully against the job requirements and produce a structured evaluation.

Job details:
{job_context}

Transcript:
{transcript}

Evaluate the candidate on these five dimensions, each scored 0-100:
1. Technical Score — correctness, depth, and relevance of technical answers
2. Communication Score — clarity, structure, and articulation of responses
3. Confidence Score — certainty and decisiveness based on transcript language patterns
4. Problem Solving Score — analytical thinking, approach to challenges, reasoning quality
5. Experience Score — demonstrated relevant experience and practical knowledge

Return ONLY valid JSON with exactly these fields (no markdown, no code fences, just raw JSON):
- overall_score: number 0-100
- recommendation: "Recommended" or "Not Recommended" or "Need Further Review"
- technical_score: number 0-100
- communication_score: number 0-100
- confidence_score: number 0-100
- problem_solving_score: number 0-100
- experience_score: number 0-100
- strengths: array of strings (max 5)
- weaknesses: array of strings (max 5)
- summary: string (2-3 paragraph evaluation summary)

Be objective and base your evaluation strictly on the transcript content."""


async def evaluate(transcript: str, job: dict) -> dict:
    """Send transcript to Claude API for structured evaluation."""
    api_key = settings.anthropic_api_key
    if not api_key:
        raise ValueError("Anthropic key missing — update ANTHROPIC_API_KEY in .env")

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    job_context = (
        f"Title: {job.get('title', 'N/A')}\n"
        f"Company: {job.get('company', 'N/A')}\n"
        f"Description: {job.get('description', 'N/A')}"
    )

    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 4096,
        "temperature": 0.3,
        "system": "You are an expert interviewer. Return ONLY valid JSON. Do NOT wrap it in markdown code blocks or any other formatting — just raw JSON.",
        "messages": [
            {
                "role": "user",
                "content": EVALUATION_PROMPT.format(
                    job_context=job_context, transcript=transcript
                ),
            }
        ],
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(CLAUDE_URL, headers=headers, json=payload)

    if response.status_code == 401:
        logger.error("Anthropic key exhausted or invalid — update ANTHROPIC_API_KEY in .env")
        raise ValueError("Claude authentication failed — check API key")

    if response.status_code == 400:
        logger.error(f"Claude bad request: {response.text}")
        raise ValueError(f"Claude evaluation request failed: {response.text}")

    if response.status_code != 200:
        logger.error(f"Claude API error: {response.status_code} {response.text}")
        raise ValueError(f"Claude evaluation failed: {response.text}")

    data = response.json()
    content = data.get("content", [])
    if not content:
        raise ValueError("Claude returned empty response")

    text = content[0].get("text", "")

    # Strip any markdown code block fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0] if "```" in text else text
        text = text.strip()

    return json.loads(text)
