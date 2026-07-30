import httpx
from app.config import settings
import logging

logger = logging.getLogger(__name__)

DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


async def transcribe_audio(audio_path: str) -> str:
    """Send audio file to Deepgram and return raw transcript."""
    api_key = settings.deepgram_api_key
    if not api_key:
        raise ValueError("Deepgram key exhausted — update DEEPGRAM_API_KEY in .env")

    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "audio/wav",
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        with open(audio_path, "rb") as f:
            audio_data = f.read()

        response = await client.post(
            f"{DEEPGRAM_URL}?model=nova-2&punctuate=true&diarize=true",
            headers=headers,
            content=audio_data,
        )

    if response.status_code == 401:
        logger.error("Deepgram key exhausted — update DEEPGRAM_API_KEY in .env")
        raise ValueError("Deepgram authentication failed — check API key")

    if response.status_code != 200:
        logger.error(f"Deepgram error: {response.status_code} {response.text}")
        raise ValueError(f"Deepgram transcription failed: {response.text}")

    data = response.json()
    transcript = data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
    return transcript
