"""Chat router — stateless SSE streaming assistant.

POST /api/chat streams the assistant's response as Server-Sent Events.
Nothing is stored server-side: the client sends the recent message history
with each request, and every tool call reads fresh data from the database.

POST /api/chat/upload lets the admin attach an interview recording directly
to the chat — it is stored and processed through the standard pipeline.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chat.agent import ChatAgent
from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.dependencies.auth import get_current_user, require_role
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("/upload", status_code=201)
async def chat_upload(
    file: UploadFile = File(...),
    candidate_email: str = Form(...),
    job_title: str = Form(default="Interview"),
    job_description: str = Form(default=""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Attach an interview recording through the chat (admin-only).

    Reuses the standard admin upload + processing pipeline: the file is
    stored, linked to the candidate by email, and processed in the
    background. Returns the interview id and status.
    """
    if not settings.CHAT_ENABLED:
        raise BadRequestError("The AI assistant is currently disabled.")

    from app.routers.admin import upload_interview

    return await upload_interview(
        file=file,
        candidate_email=candidate_email,
        job_title=job_title,
        job_description=job_description,
        background_tasks=background_tasks,
        current_user=current_user,
        db=db,
    )


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
