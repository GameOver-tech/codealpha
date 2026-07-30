import httpx
from app.config import settings
import logging

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

EVALUATION_PROMPT = """You are an expert technical interviewer evaluating a candidate's interview transcript. Analyze the transcript carefully and produce a structured evaluation.

Job details:
{job_context}

Transcript:
{transcript}

Return a JSON object with exactly these fields:
- technical_score: number 0-100
- communication_score: number 0-100
- confidence_score: number 0-100
- problem_solving_score: number 0-100
- experience_score: number 0-100
- overall_score: number 0-100
- recommendation: "Recommended" or "Not Recommended" or "Need Further Review"
- strengths: array of strings (max 5)
- weaknesses: array of strings (max 5)
- ai_summary: string (2-3 paragraph summary)
- evidence: object with categories as keys, each containing an array of { "quote": string, "timestamp": string } objects. Categories: Technical Knowledge, Problem Solving, Communication Skills, Relevant Experience

Be objective and base your evaluation strictly on the transcript content."""
import json


async def evaluate(transcript: str, job: dict) -> dict:
    """Send transcript to OpenRouter for evaluation."""
    api_key = settings.openrouter_api_key
    if not api_key:
        raise ValueError("OpenRouter key exhausted — update OPENROUTER_API_KEY in .env")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    job_context = f"Title: {job.get('title', 'N/A')}\nCompany: {job.get('company', 'N/A')}\nDescription: {job.get('description', 'N/A')}"

    system_prompt = "You are an expert interviewer. Return ONLY valid JSON. Do NOT wrap it in markdown code blocks or any other formatting — just raw JSON."

    payload = {
        "model": "openai/gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": EVALUATION_PROMPT.format(job_context=job_context, transcript=transcript)},
        ],
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OPENROUTER_URL, headers=headers, json=payload)

    if response.status_code in (401, 402):
        logger.error("OpenRouter key exhausted — update OPENROUTER_API_KEY in .env")
        raise ValueError("OpenRouter authentication failed — check API key")

    if response.status_code != 200:
        logger.error(f"OpenRouter error: {response.status_code} {response.text}")
        raise ValueError(f"OpenRouter evaluation failed: {response.text}")

    data = response.json()
    content = data["choices"][0]["message"]["content"]
    # Strip any markdown code block fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1] if "\n" in content else content[3:]
        content = content.rsplit("```", 1)[0] if "```" in content else content
        content = content.strip()
    return json.loads(content)
