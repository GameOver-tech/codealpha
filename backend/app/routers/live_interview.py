"""Live AI Interview — candidate self-service interview module.

Candidates start a live AI interview, record a ~3-minute video+audio
response, and upload it as a TEMPORARY file. The existing processing
pipeline (Deepgram transcription → LLM evaluation → scoring →
recommendation → report → PDF) handles it exactly like an admin-uploaded
recording; the pipeline's Stage-11 cleanup deletes the temp file.

Endpoints:
  POST /api/live-interview/start                     — create the interview row (type=live)
  POST /api/live-interview/{interview_id}/upload     — upload the recorded webm + dispatch pipeline
  GET  /api/live-interview/{interview_id}/status     — owned interview status for the UI

Security: every endpoint requires an authenticated user; the upload/status
endpoints verify the interview belongs to the signed-in candidate.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.deepgram import probe_media_duration
from app.core.database import get_db
from app.core.logging import get_logger
from app.dependencies.auth import get_current_user
from app.models.interview import Interview, InterviewStatus
from app.models.user import User
from app.repositories.activity_log import ActivityLogRepository
from app.repositories.interview import InterviewRepository
from app.repositories.interview_file import InterviewFileRepository
from app.storage.service import LocalStorage
from app.utils.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.utils.file_validation import validate_upload

logger = get_logger(__name__)

router = APIRouter(prefix="/api/live-interview", tags=["Live Interview"])


class LiveInterviewStart(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_title: str = "Live AI Interview"
    job_description: str = ""


class LiveInterviewStartResponse(BaseModel):
    interview_id: str
    status: str = "uploaded"


class LiveInterviewStatusResponse(BaseModel):
    interview_id: str
    status: str
    admin_status: str


async def _owned_interview(
    db: AsyncSession, user: User, interview_id: str
) -> Interview:
    """Load an interview and verify the signed-in candidate owns it."""
    interview = await InterviewRepository(db).get(interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")
    if interview.candidate_id != user.id:
        raise ForbiddenError("Not authorized to access this interview")
    return interview


@router.post("/start", response_model=LiveInterviewStartResponse, status_code=201)
async def start_live_interview(
    payload: LiveInterviewStart,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new live AI interview for the signed-in candidate.

    Only candidates may start. A candidate cannot start a new session while
    they already have one that is still pending (uploaded/processing/...).
    """
    from app.models.user import UserRole

    if current_user.role != UserRole.CANDIDATE:
        raise ForbiddenError("Only candidates can start a live interview")

    repo = InterviewRepository(db)
    latest = await repo.latest_for_candidate(current_user.id)
    if latest is not None:
        # A live interview left in 'uploaded' with NO file means the candidate
        # started the session but never submitted a recording (closed the tab /
        # lost connection). Don't let it block them forever or show as
        # "auto-running" on every login — mark it failed so they can retry.
        from app.repositories.interview_file import InterviewFileRepository

        has_file = bool(await InterviewFileRepository(db).list_by_interview(latest.id))
        if (
            latest.interview_type == "live"
            and latest.status == InterviewStatus.UPLOADED
            and not has_file
        ):
            await repo.mark_failed(
                latest.id,
                reason="This live interview was started but never submitted.",
                stage="live_not_submitted",
                traceback_text="",
            )
            await db.commit()

        active_statuses = {
            InterviewStatus.UPLOADED,
            InterviewStatus.PROCESSING,
            InterviewStatus.TRANSCRIPT_READY,
            InterviewStatus.AI_EVALUATION,
            InterviewStatus.PDF_GENERATED,
        }
        if latest.status in active_statuses:
            raise BadRequestError(
                "You already have an interview in progress. Please wait for it to complete."
            )

        # A candidate may only ever take ONE live AI interview. Once a live
        # interview has been submitted (a recording file exists), they cannot
        # start another one — regardless of whether it completed or failed.
        if latest.interview_type == "live" and has_file:
            raise BadRequestError(
                "You have already submitted a live AI interview. "
                "Only one live interview is allowed per candidate."
            )

    interview = await repo.create(
        candidate_id=current_user.id,
        job_title=payload.job_title,
        job_description=payload.job_description,
        evaluation_criteria=[],
    )
    interview.interview_type = "live"
    interview.admin_status = "Pending"
    interview.status = InterviewStatus.UPLOADED
    await ActivityLogRepository(db).log(
        current_user.id,
        "live_interview_started",
        "interview",
        str(interview.id),
        {"interview_type": "live"},
    )
    await db.commit()

    # Invalidate the admin TTL caches so the new pending live interview
    # appears immediately in the admin processing/dashboard views.
    from app.routers.admin import invalidate_dashboard_cache

    invalidate_dashboard_cache()

    logger.info(
        "Live interview started: interview=%s candidate=%s",
        interview.id,
        current_user.email,
    )
    return LiveInterviewStartResponse(interview_id=str(interview.id))


@router.post("/{interview_id}/upload", response_model=LiveInterviewStatusResponse, status_code=202)
async def upload_live_interview_recording(
    interview_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload the recorded webm for a live interview and start processing.

    Mirrors the admin upload flow: validate → save temp file under
    uploads/recordings/{interview_id}/ → create InterviewFile row → probe
    duration → dispatch the SAME pipeline. The pipeline's Stage-11 cleanup
    deletes the temporary recording after transcription.
    """
    interview = await _owned_interview(db, current_user, interview_id)
    if interview.status not in (InterviewStatus.UPLOADED, InterviewStatus.FAILED):
        raise BadRequestError("This interview is not awaiting an upload.")

    validate_upload(file)

    storage = LocalStorage()
    rel_path, size_bytes = await asyncio.to_thread(
        storage.save_upload, file, f"recordings/{interview.id}"
    )

    duration = await asyncio.to_thread(
        probe_media_duration, storage.abs_path(rel_path)
    )
    if not duration:
        duration = 0

    await InterviewFileRepository(db).create(
        interview_id=interview.id,
        original_filename=file.filename or "live_interview.webm",
        storage_path=rel_path,
        content_type=file.content_type or "",
        file_size_bytes=size_bytes,
        duration_seconds=int(duration),
    )
    if duration:
        interview.duration_seconds = int(duration)

    # Transcribe the recording INLINE and store the transcript immediately.
    # The admin can then Process the interview from the stored transcript even
    # if the background pipeline's transcription is skipped or re-run later —
    # the recording itself stays temporary (deleted after processing).
    transcript_saved = False
    try:
        from app.ai.deepgram import transcribe_audio
        from app.repositories.analysis import TranscriptRepository

        result = await transcribe_audio(rel_path)
        await TranscriptRepository(db).upsert(
            interview.id,
            {
                "full_text": result.get("full_text", ""),
                "segments": result.get("segments", []),
                "speakers": result.get("speakers", []),
                "language": result.get("language", "en"),
                "confidence": result.get("confidence", 0.0),
                "source": result.get("source", "deepgram"),
                "raw_response": result.get("raw_response"),
            },
        )
        interview.has_speech = bool(result.get("has_speech", True))
        if result.get("duration") and not interview.duration_seconds:
            interview.duration_seconds = int(result["duration"])
        transcript_saved = True
        logger.info(
            "Live interview transcribed inline: interview=%s length=%s",
            interview.id,
            len(result.get("full_text", "")),
        )
    except Exception as exc:  # noqa: BLE001 — never fail the submission
        logger.warning(
            "Inline transcription failed for live interview %s: %s",
            interview.id,
            exc,
        )

    await ActivityLogRepository(db).log(
        current_user.id,
        "live_interview_uploaded",
        "interview",
        str(interview.id),
        {
            "filename": file.filename,
            "size_bytes": size_bytes,
            "duration_seconds": int(duration),
            "transcript_saved": transcript_saved,
        },
    )
    await db.commit()

    from app.routers.admin import invalidate_dashboard_cache, _submit_pipeline

    invalidate_dashboard_cache()
    await _submit_pipeline(interview.id, background_tasks)

    logger.info(
        "Live interview uploaded: interview=%s size=%s duration=%s transcript=%s — pipeline dispatched",
        interview.id,
        size_bytes,
        int(duration),
        transcript_saved,
    )
    return LiveInterviewStatusResponse(
        interview_id=str(interview.id),
        status="processing",
        admin_status="Pending",
    )


@router.get("/{interview_id}/status", response_model=LiveInterviewStatusResponse)
async def get_live_interview_status(
    interview_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the signed-in candidate's live interview status."""
    interview = await _owned_interview(db, current_user, interview_id)
    return LiveInterviewStatusResponse(
        interview_id=str(interview.id),
        status=interview.status.value,
        admin_status=interview.admin_status,
    )
