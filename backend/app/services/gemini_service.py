import httpx
from app.config import settings
import logging
import json

logger = logging.getLogger(__name__)

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
- evidence: object with categories as keys, each containing an array of {{ "quote": string, "timestamp": string }} objects. Categories: Technical Knowledge, Problem Solving, Communication Skills, Relevant Experience

Be objective and base your evaluation strictly on the transcript content. Return ONLY valid JSON, no markdown formatting."""


async def evaluate(transcript: str, job: dict) -> dict:
    """Send transcript to Gemini for evaluation."""
    api_key = settings.gemini_api_key
    if not api_key:
        raise ValueError("Gemini key exhausted — update GEMINI_API_KEY in .env")

    job_context = f"Title: {job.get('title', 'N/A')}\nCompany: {job.get('company', 'N/A')}\nDescription: {job.get('description', 'N/A')}"
    prompt = EVALUATION_PROMPT.format(job_context=job_context, transcript=transcript)

    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 4096,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code == 403 or response.status_code == 401:
        logger.error("Gemini key exhausted — update GEMINI_API_KEY in .env")
        raise ValueError("Gemini authentication failed — check API key")

    if response.status_code != 200:
        logger.error(f"Gemini error: {response.status_code} {response.text}")
        raise ValueError(f"Gemini evaluation failed: {response.text}")

    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]

    # Strip any markdown code block fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1] if "\n" in content else content[3:]
        content = content.rsplit("```", 1)[0] if "```" in content else content
        content = content.strip()

    return json.loads(content)
