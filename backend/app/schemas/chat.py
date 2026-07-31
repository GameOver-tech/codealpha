"""Pydantic schemas for the AI chat assistant (stateless)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ChatHistoryItem(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=40)
