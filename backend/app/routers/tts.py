"""Text-to-Speech router (ElevenLabs).

POST /api/tts         — synthesize MP3 audio for the given text (streamed).
GET  /api/tts/voices  — list available ElevenLabs voices.

Authentication is required for every call; the API key stays on the server.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.tts import TTSRequest
from app.services import tts_service

router = APIRouter(prefix="/api/tts", tags=["TTS"])

_MP3_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


@router.post("")
async def synthesize(
    payload: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    """Synthesize speech for `text` and return MP3 audio.

    Uses ElevenLabs, with an on-disk cache keyed by text+voice hash. The
    audio bytes are streamed directly — never base64-encoded.
    """
    audio = await tts_service.synthesize_speech(
        payload.text,
        voice_id=payload.voice_id or None,
        model_id=payload.model_id or None,
    )
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers=_MP3_HEADERS,
    )


@router.get("/voices")
async def voices(current_user: User = Depends(get_current_user)):
    """List the ElevenLabs voices available to this workspace."""
    return {"voices": await tts_service.list_voices()}
