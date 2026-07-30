import httpx
import logging
from app.config import settings

logger = logging.getLogger(__name__)

WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions"


async def transcribe_audio(audio_path: str) -> str:
    """Send audio file to OpenAI Whisper API and return the transcript text."""
    api_key = settings.openai_api_key
    if not api_key:
        raise ValueError("OpenAI key missing — update OPENAI_API_KEY in .env")

    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        with open(audio_path, "rb") as f:
            files = {
                "file": ("audio.wav", f, "audio/wav"),
                "model": (None, "whisper-1"),
                "response_format": (None, "json"),
                "language": (None, "en"),
            }
            response = await client.post(WHISPER_URL, headers=headers, files=files)

    if response.status_code == 401:
        logger.error("OpenAI key exhausted or invalid — update OPENAI_API_KEY in .env")
        raise ValueError("Whisper authentication failed — check API key")

    if response.status_code != 200:
        logger.error(f"Whisper API error: {response.status_code} {response.text}")
        raise ValueError(f"Whisper transcription failed: {response.text}")

    data = response.json()
    transcript = data.get("text", "")
    if not transcript:
        raise ValueError("Whisper returned empty transcript")
    return transcript
