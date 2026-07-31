"""Admin endpoints — upload recordings, trigger processing, view analysis,
regenerate results from a stored transcript, and delete interviews.
"""
from __future__ import annotations

import asyncio
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.dependencies.auth import require_role
from app.models.interview import Interview, InterviewStatus
from app.models.user import User
from app.repositories.analysis import (
    InterviewReportRepository,
    InterviewScoresRepository,
    RecommendationRepository,
    SentimentAnalysisRepository,
    SpeechAnalysisRepository,
    StrengthRepository,
    TechnicalEvaluationRepository,
    TranscriptRepository,
    WeaknessRepository,
)
from app.repositories.interview import InterviewRepository
from app.repositories.interview_file import ActivityLogRepository, InterviewFileRepository
from app.repositories.user import UserRepository
from app.schemas.interview import (
    AnalysisBundle,
    InterviewResult,
    RegenerateRequest,
    TranscriptOut,
)
from app.schemas.profile import RecommendationMessage
from app.services.pipeline_service import enqueue_interview_processing, run_interview_pipeline
from app.storage.service import LocalStorage
from app.utils.exceptions import BadRequestError, NotFoundError
from app.utils.file_validation import validate_upload

logger = get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

QUEUE_KEY = "hirelens:interview-queue"


def _require_admin(current_user: User):
    """Helper to mark an endpoint admin-only (used via Depends below)."""
    return current_user


async def _submit_pipeline(interview_id, background_tasks: BackgroundTasks) -> None:
    """Dispatch pipeline work to Redis (when enabled) or BackgroundTasks."""
    if await enqueue_interview_processing(interview_id):
        return
    background_tasks.add_task(_run_pipeline_task, str(interview_id))


# --- Upload & Process -------------------------------------------------------


@router.post("/upload", status_code=201)
async def upload_interview(
    file: UploadFile = File(...),
    job_title: str = Form(default="Interview"),
    job_description: str = Form(default=""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Upload an interview recording (video/audio). Processing starts automatically.

    Supported formats: MP4, MOV, AVI, MKV, MP3, WAV, M4A, FLAC, AAC (max 200MB).
    """
    validate_upload(file)

    interviews = InterviewRepository(db)
    interview = await interviews.create(
        candidate_id=current_user.id,
        job_title=job_title,
        job_description=job_description,
    )
    await db.flush()

    storage = LocalStorage()
    rel_path, size_bytes = storage.save_upload(file, f"recordings/{interview.id}")
    file_id = uuid.uuid4()

    files = InterviewFileRepository(db)
    await files.create(
        interview_id=interview.id,
        original_filename=file.filename or "recording",
        storage_path=rel_path,
        content_type=file.content_type or "",
        file_size_bytes=size_bytes,
    )

    await ActivityLogRepository(db).log(
        current_user.id, "interview_uploaded", "interview", str(interview.id),
        {"filename": file.filename, "size_bytes": size_bytes},
    )
    await db.commit()

    # Kick off the pipeline in the background (Redis queue or BackgroundTasks).
    interview.started_at = datetime.now(timezone.utc)
    await db.commit()
    await _submit_pipeline(interview.id, background_tasks)

    return {
        "interview_id": str(interview.id),
        "file_id": str(file_id),
        "status": "processing",
        "message": "Upload successful. Processing will start automatically.",
    }


async def _run_pipeline_task(interview_id: str) -> None:
    """Background entry point — opens its own DB session.

    The pipeline itself guarantees the interview ends in COMPLETED or
    FAILED. This wrapper logs any escaped error and attempts a final
    FAILED status as a safety net.
    """
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            await run_interview_pipeline(db, interview_id)
        except asyncio.CancelledError:
            logger.warning("Pipeline task cancelled for interview %s", interview_id)
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Background pipeline failed for %s", interview_id)
            try:
                from app.repositories.interview import InterviewRepository

                # Safety net: guarantee terminal FAILED state.
                await InterviewRepository(db).mark_failed(
                    interview_id,
                    reason=f"{exc}"[:1000],
                    stage="background_task",
                    traceback_text=traceback.format_exc()[-4000:],
                )
                await db.commit()
            except Exception:  # noqa: BLE001
                logger.exception("Safety-net FAILED status also failed for %s", interview_id)


@router.post("/process", status_code=202)
async def process_interview(
    payload: RegenerateRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Trigger processing for an interview (admin-only).

    If a transcript already exists the evaluation is regenerated from it
    without re-transcribing (see /regenerate for an explicit re-run).
    """
    interviews = InterviewRepository(db)
    interview = await interviews.get(str(payload.interview_id))
    if interview is None:
        raise NotFoundError("Interview not found")

    if interview.status not in (InterviewStatus.UPLOADED, InterviewStatus.FAILED):
        raise BadRequestError(
            f"Interview is already {interview.status.value}. "
            "Only uploaded or failed interviews can be processed."
        )

    await _submit_pipeline(interview.id, background_tasks)
    return {
        "interview_id": str(interview.id),
        "status": "processing",
        "message": "Processing started. Check the interview status to track progress.",
    }


# --- Progress / status -------------------------------------------------------


@router.get("/interview/{interview_id}/progress")
async def get_interview_progress(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get the processing progress (0-100) and current stage for an interview."""
    repo = InterviewRepository(db)
    interview = await repo.get(str(interview_id))
    if interview is None:
        raise NotFoundError("Interview not found")

    return {
        "interview_id": str(interview.id),
        "status": interview.status.value,
        "progress": interview.processing_progress,
        "stage": interview.current_stage or "",
        "failure_stage": interview.failure_stage or "",
        "failure_reason": interview.failure_reason or "",
        "started_at": interview.started_at.isoformat() if interview.started_at else None,
        "processing_finished_at": (
            interview.processing_finished_at.isoformat()
            if interview.processing_finished_at
            else None
        ),
    }


# --- View endpoints (admin) --------------------------------------------------


async def _get_interview_full(db: AsyncSession, interview_id: str) -> Interview:
    repo = InterviewRepository(db)
    interview = await repo.get_full(interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")
    return interview


@router.get("/transcript", response_model=TranscriptOut)
async def get_transcript(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get the timestamped transcript for an interview."""
    repo = TranscriptRepository(db)
    transcript = await repo.get_by_interview(interview_id)
    if transcript is None:
        raise NotFoundError("No transcript yet — the interview may still be processing.")
    return transcript


@router.get("/analysis", response_model=AnalysisBundle)
async def get_analysis(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get the full analysis bundle for an interview (all artifacts)."""
    interview = await _get_interview_full(db, interview_id)

    tech = interview.technical_evaluation
    scores = interview.scores
    report = interview.report

    strengths = [s.text for s in interview.strengths]
    weaknesses = [w.text for w in interview.weaknesses]

    tech_dict = None
    if tech is not None:
        from sqlalchemy import inspect

        tech_dict = {
            c.key: getattr(tech, c.key)
            for c in inspect(tech).mapper.column_attrs
            if c.key not in ("id", "interview_id", "created_at", "updated_at")
        }

    return AnalysisBundle(
        transcript=interview.transcript,
        speech_analysis=interview.speech_analysis,
        sentiment_analysis=interview.sentiment_analysis,
        technical_evaluation=tech_dict,
        scores=scores,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendation=interview.recommendation,
        report=report,
    )


@router.get("/scores", response_model=dict)
async def get_scores(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get the automated 0-100 scores for an interview."""
    repo = InterviewScoresRepository(db)
    scores = await repo.get_by_interview(interview_id)
    if scores is None:
        raise NotFoundError("Scores not available yet.")
    return scores.score_map


@router.get("/recommendation", response_model=RecommendationMessage)
async def get_recommendation(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get the hiring recommendation + candidate-facing message."""
    repo = RecommendationRepository(db)
    rec = await repo.get_by_interview(interview_id)
    if rec is None:
        raise NotFoundError("Recommendation not available yet.")

    from app.utils.recommendation_messages import get_recommendation_message

    return RecommendationMessage(
        verdict=rec.verdict.value,
        message=get_recommendation_message(rec.verdict.value),
    )


@router.get("/report", response_model=dict)
async def get_report(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get the full professional interview report."""
    repo = InterviewReportRepository(db)
    report = await repo.get_by_interview(interview_id)
    if report is None:
        raise NotFoundError("Report not available yet.")

    from sqlalchemy import inspect

    return {
        c.key: getattr(report, c.key)
        for c in inspect(report).mapper.column_attrs
        if c.key not in ("id", "interview_id", "created_at", "updated_at")
    }


@router.get("/report/pdf")
async def get_report_pdf(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Download the generated PDF report for an interview."""
    from app.services.pdf_download import download_pdf_for_interview

    interview = await _get_interview_full(db, interview_id)
    pdf = interview.pdfs[-1] if interview.pdfs else None
    if pdf is None:
        raise NotFoundError("PDF report not generated yet.")

    data, content_type = await download_pdf_for_interview(pdf.storage_path, pdf.filename)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{pdf.filename}"'},
    )


@router.get("/interviews", response_model=list[dict])
async def list_interviews(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all interviews with candidate name/email and status."""
    repo = InterviewRepository(db)
    interviews = await repo.list_all_full()
    result = []
    for interview in interviews:
        candidate = await UserRepository(db).get(interview.candidate_id)
        rec = interview.recommendation
        result.append(
            {
                "id": str(interview.id),
                "candidate_id": str(interview.candidate_id),
                "candidate_name": candidate.full_name if candidate else "—",
                "candidate_email": candidate.email if candidate else "—",
                "job_title": interview.job_title,
                "status": interview.status.value,
                "progress": interview.processing_progress,
                "stage": interview.current_stage or "",
                "duration_seconds": interview.duration_seconds,
                "overall_score": interview.scores.overall_score if interview.scores else None,
                "recommendation": rec.verdict.value if rec else None,
                "failure_reason": interview.failure_reason,
                "failure_stage": interview.failure_stage,
                "processing_finished_at": (
                    interview.processing_finished_at.isoformat()
                    if interview.processing_finished_at
                    else None
                ),
                "created_at": interview.created_at.isoformat() if interview.created_at else None,
            }
        )
    return result


# --- Regenerate / delete -----------------------------------------------------


@router.post("/regenerate", status_code=202)
async def regenerate_result(
    payload: RegenerateRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate the evaluation result from the existing transcript.

    Skips speech-to-text and re-runs analysis + LLM evaluation + PDF.
    """
    repo = TranscriptRepository(db)
    transcript = await repo.get_by_interview(payload.interview_id)
    if transcript is None:
        raise NotFoundError(
            "No transcript exists for this interview. Use POST /api/admin/process to transcribe first."
        )

    interviews = InterviewRepository(db)
    interview = await interviews.get(payload.interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")

    await _submit_pipeline(interview.id, background_tasks)
    return {
        "interview_id": str(interview.id),
        "status": "processing",
        "message": "Regeneration started. Evaluation will be rebuilt from the existing transcript.",
    }


@router.post("/status/recommendation/not-recommendation")
async def override_recommendation(
    interview_id: str,
    verdict: str,
    reason: str = "",
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Manually override the hiring recommendation (admin review override).

    Valid verdicts: Recommended | Not Recommended | Need Further Review.
    """
    from app.models.recommendation import RecommendationVerdict

    try:
        normalized = RecommendationVerdict(verdict)
    except ValueError:
        raise BadRequestError(
            "Invalid verdict. Use one of: Recommended, Not Recommended, Need Further Review."
        )

    repo = RecommendationRepository(db)
    rec = await repo.upsert(interview_id, normalized.value, reason)
    await db.commit()

    await ActivityLogRepository(db).log(
        current_user.id,
        "recommendation_overridden",
        "interview",
        interview_id,
        {"verdict": normalized.value},
    )
    await db.commit()

    return RecommendationMessage(
        verdict=rec.verdict.value,
        message=reason or "Recommendation updated.",
    )


@router.delete("/interview/{interview_id}", status_code=200)
async def delete_interview(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete an interview and all of its artifacts (cascade)."""
    repo = InterviewRepository(db)
    interview = await repo.get_full(str(interview_id))
    if interview is None:
        raise NotFoundError("Interview not found")

    # Best-effort cleanup of stored files.
    storage = LocalStorage()
    for file in interview.files:
        storage.delete(file.storage_path)

    await repo.delete(str(interview_id))
    await db.commit()

    await ActivityLogRepository(db).log(
        current_user.id, "interview_deleted", "interview", interview_id
    )
    await db.commit()

    return {"message": f"Interview {interview_id} deleted successfully."}
