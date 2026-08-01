"""Pydantic schemas for the TTS router."""
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    voice_id: str = Field(default="", max_length=200)
    model_id: str = Field(default="", max_length=100)
