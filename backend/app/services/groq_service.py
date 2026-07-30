import httpx
from app.config import settings
import logging

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def refine_transcript(raw_transcript: str) -> str:
    """Send raw transcript to Groq for refinement (clean up, structure, punctuation)."""
    api_key = settings.groq_api_key
    if not api_key:
        raise ValueError("Groq key exhausted — update GROQ_API_KEY in .env")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "mixtral-8x7b-32768",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a transcript refinement assistant. Clean up the following raw interview transcript. "
                    "Fix punctuation, remove filler words (um, uh, like, you know), add proper paragraph breaks, "
                    "and correct obvious transcription errors. Preserve the speaker labels if available. "
                    "Return only the refined transcript, no extra commentary."
                ),
            },
            {"role": "user", "content": raw_transcript},
        ],
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(GROQ_URL, headers=headers, json=payload)

    if response.status_code == 401:
        logger.error("Groq key exhausted — update GROQ_API_KEY in .env")
        raise ValueError("Groq authentication failed — check API key")

    if response.status_code != 200:
        logger.error(f"Groq error: {response.status_code} {response.text}")
        raise ValueError(f"Groq refinement failed: {response.text}")

    data = response.json()
    refined = data["choices"][0]["message"]["content"]
    return refined
