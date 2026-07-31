"""Chat router — stateless SSE streaming assistant.

POST /api/chat streams the assistant's response as Server-Sent Events.
Nothing is stored server-side: the client sends the recent message history
with each request, and every tool call reads fresh data from the database.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chat.agent import ChatAgent
from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("")
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream an assistant turn for the authenticated user.

    Stateless: the client sends the conversation history with each request.
    Returns a text/event-stream of events: `message` (delta chunks),
    `tool` (tool lifecycle), and `done` (final content).
    """
    if not settings.CHAT_ENABLED:
        raise BadRequestError("The AI assistant is currently disabled.")

    message = payload.message.strip()
    if not message:
        raise BadRequestError("message cannot be empty")

    # Pydantic models → plain dicts for the agent's history window.
    history = [{"role": h.role, "content": h.content} for h in payload.history]

    async def event_stream():
        agent = ChatAgent(db, current_user)
        try:
            async for event in agent.run(message, history):
                if event["type"] == "delta":
                    yield _sse("message", {"delta": event["content"]})
                elif event["type"] == "tool_start":
                    yield _sse("tool", {"name": event["name"], "status": "started"})
                elif event["type"] == "tool_done":
                    yield _sse("tool", {"name": event["name"], "status": "done"})
                elif event["type"] == "tool_error":
                    yield _sse(
                        "tool",
                        {"name": event["name"], "status": "error", "error": event["error"]},
                    )
                elif event["type"] == "done":
                    yield _sse("done", {"content": event["content"]})
        except Exception as exc:  # noqa: BLE001
            logger.exception("Chat turn failed")
            yield _sse("error", {"message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
