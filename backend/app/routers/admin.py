"""Admin endpoints — upload recordings, trigger processing, view analysis,
regenerate results from a stored transcript, and delete interviews.
"""
from __future__ import annotations

import asyncio
import time
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.deepgram import probe_media_duration
from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.supabase_client import get_supabase_service
from app.dependencies.auth import require_role
from app.models.interview import Interview, InterviewStatus
from app.models.user import User, UserRole
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

# In-process TTL cache for the dashboard payload. The database is a hosted
# Supabase instance with ~3s per round-trip latency; the dashboard polls
# every 30s, so caching avoids paying that latency on every poll. Invalidated
# on any interview mutation (upload/delete/status change).
_dashboard_cache: tuple[float, dict] | None = None
DASHBOARD_CACHE_TTL_SECONDS = 15.0

# In-process TTL cache for the per-interview analysis bundle. The candidate
# report page (Overview/Evaluation/Transcript/AI Insights) depends on this
# heavy payload, so the first load pays the DB latency and every tab switch
# or back-navigation within the TTL is served instantly from memory.
_analysis_cache: dict[str, tuple[float, dict]] = {}
ANALYSIS_CACHE_TTL_SECONDS = 60.0

# In-process TTL cache for the full interview list (candidates page +
# notification bell). Polled every 15-60s in the frontend, so a short TTL
# keeps it fresh without paying ~3s per poll against the remote DB.
_interviews_cache: tuple[float, list] | None = None
INTERVIEWS_CACHE_TTL_SECONDS = 15.0


def invalidate_dashboard_cache() -> None:
    global _dashboard_cache, _interviews_cache
    _dashboard_cache = None
    _interviews_cache = None
    # A mutation invalidates every cached analysis too — the cached payload
    # is only valid for the interview that produced it.
    _analysis_cache.clear()


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
    candidate_email: str = Form(...),
    job_title: str = Form(default="Interview"),
    job_description: str = Form(default=""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Upload an interview recording (video/audio). Processing starts automatically.

    The interview is ALWAYS linked to the candidate whose email is provided.
    Only registered candidate accounts can receive interviews — an unknown
    email is rejected with a 404 and no interview row is created.

    Supported formats: MP4, MOV, AVI, MKV, MP3, WAV, M4A, FLAC, AAC (max 200MB).
    """
    validate_upload(file)

    # Resolve the candidate the interview belongs to. Never anonymous.
    candidate_email = candidate_email.strip().lower()
    if not candidate_email:
        raise BadRequestError("candidate_email is required to upload an interview")
    users = UserRepository(db)
    candidate = await users.get_by_email(candidate_email)
    if candidate is None:
        raise HTTPException(
            status_code=404,
            detail=f"No candidate found with email '{candidate_email}'. "
            "The candidate must register before an interview can be uploaded for them.",
        )
    if candidate.role != UserRole.CANDIDATE:
        raise BadRequestError(
            f"'{candidate_email}' is not a candidate account — only candidates can be evaluated."
        )

    interviews = InterviewRepository(db)
    interview = await interviews.create(
        candidate_id=candidate.id,
        job_title=job_title,
        job_description=job_description,
    )
    await db.flush()

    storage = LocalStorage()
    # File I/O offloaded to a worker thread so the event loop stays free.
    rel_path, size_bytes = await asyncio.to_thread(
        storage.save_upload, file, f"recordings/{interview.id}"
    )

    # Extract the real media duration at upload time so every view (PDF,
    # admin details, candidate dashboard, reports) shows the actual length
    # instead of 0m 00s. Falls back to 0 only if the probe itself fails —
    # the pipeline later overwrites it from Deepgram metadata when available.
    duration = round(
        await asyncio.to_thread(probe_media_duration, storage.abs_path(rel_path))
    )
    interview.duration_seconds = duration

    file_id = uuid.uuid4()

    files = InterviewFileRepository(db)
    await files.create(
        interview_id=interview.id,
        original_filename=file.filename or "recording",
        storage_path=rel_path,
        content_type=file.content_type or "",
        file_size_bytes=size_bytes,
        duration_seconds=duration,
    )

    await ActivityLogRepository(db).log(
        current_user.id, "interview_uploaded", "interview", str(interview.id),
        {
            "filename": file.filename,
            "size_bytes": size_bytes,
            "candidate_id": str(candidate.id),
            "duration_seconds": duration,
        },
    )
    await db.commit()

    # Kick off the pipeline in the background (Redis queue or BackgroundTasks).
    interview.started_at = datetime.now(timezone.utc)
    await db.commit()
    invalidate_dashboard_cache()
    await _submit_pipeline(interview.id, background_tasks)

    return {
        "interview_id": str(interview.id),
        "file_id": str(file_id),
        "candidate_id": str(candidate.id),
        "candidate_email": candidate.email,
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
    """Get the full analysis bundle for an interview (all artifacts).

    Served from an in-process TTL cache when fresh — the report page
    (Overview/Evaluation/Transcript/AI Insights) reloads this payload on
    every navigation, and the remote DB costs ~3s per round trip.
    """
    import time as _time

    now = _time.monotonic()
    cached = _analysis_cache.get(interview_id)
    if cached is not None and now - cached[0] < ANALYSIS_CACHE_TTL_SECONDS:
        return cached[1]

    repo = InterviewRepository(db)
    interview = await repo.get_for_analysis(interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")

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

    bundle = AnalysisBundle(
        transcript=interview.transcript,
        speech_analysis=interview.speech_analysis,
        sentiment_analysis=interview.sentiment_analysis,
        technical_evaluation=tech_dict,
        scores=scores,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendation=interview.recommendation,
        report=report,
    ).model_dump(mode="json")

    _analysis_cache[interview_id] = (now, bundle)
    return bundle


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
    """Download the PDF report for an interview.

    The PDF is generated ON DEMAND from the stored interview results
    (transcript, scores, recommendation, report). It never re-runs
    Deepgram or the LLM, and nothing is written to disk or the database —
    the PDF is returned directly to the client.
    """
    pdf_bytes, filename = await _generate_report_pdf(db, current_user, interview_id)
    return _pdf_response(pdf_bytes, filename)


@router.post("/report/pdf/download")
async def download_report_pdf(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """POST variant of the PDF download.

    Download managers (IDM, etc.) only intercept GET requests — a POST
    download is never hijacked, so this is the reliable path from the app.
    """
    pdf_bytes, filename = await _generate_report_pdf(db, current_user, interview_id, log_action="pdf_generated")
    return _pdf_response(pdf_bytes, filename)


@router.post("/report/pdf/regenerate")
async def regenerate_report_pdf_post(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """POST variant of the regenerate-PDF action (same IDM-safe rationale)."""
    pdf_bytes, filename = await _generate_report_pdf(db, current_user, interview_id, log_action="pdf_regenerated")
    return _pdf_response(pdf_bytes, filename)


@router.get("/report/pdf/regenerate")
async def regenerate_report_pdf(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate the PDF from stored results.

    Identical to the on-demand generator — this is an explicit admin action
    that rebuilds the PDF in seconds without reprocessing the interview.
    """
    pdf_bytes, filename = await _generate_report_pdf(db, current_user, interview_id, log_action="pdf_regenerated")
    return _pdf_response(pdf_bytes, filename)


async def _generate_report_pdf(db, current_user, interview_id, *, log_action: str = "pdf_generated"):
    """Shared PDF generation + audit logging for all download variants."""
    from app.services.pdf_service import generate_pdf_ondemand

    pdf_bytes, filename = await generate_pdf_ondemand(db, interview_id)

    await ActivityLogRepository(db).log(
        current_user.id, log_action, "interview", interview_id,
        {"filename": filename, "on_demand": True},
    )
    await db.commit()
    return pdf_bytes, filename


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/dashboard", response_model=dict)
async def get_admin_dashboard(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight dashboard payload: aggregated stats + recent interviews.

    Stats are computed in ONE aggregate query (via analytics.dashboard_stats)
    instead of downloading every interview row and counting client-side.
    Recent interviews are limited to the latest 6 with only the fields the
    dashboard renders. Served from an in-process TTL cache to avoid the
    remote DB latency on every 30s poll.
    """
    global _dashboard_cache
    now = time.monotonic()
    if _dashboard_cache is not None and now - _dashboard_cache[0] < DASHBOARD_CACHE_TTL_SECONDS:
        return _dashboard_cache[1]

    from app.tools import analytics

    interviews = InterviewRepository(db)
    recent_rows = await interviews.list_recent_summary(6)

    recent = []
    for interview in recent_rows:
        candidate = interview.candidate
        rec = interview.recommendation
        recent.append(
            {
                "id": str(interview.id),
                "candidate_id": str(interview.candidate_id),
                "candidate_name": candidate.full_name if candidate else "—",
                "candidate_email": candidate.email if candidate else "—",
                "job_title": interview.job_title,
                "status": interview.status.value,
                "admin_status": interview.admin_status,
                "overall_score": interview.scores.overall_score if interview.scores else None,
                "recommendation": rec.verdict.value if rec else None,
                "profile_picture_url": (
                    candidate.profile.profile_picture_url
                    if candidate is not None and candidate.profile is not None
                    else None
                ),
                "created_at": interview.created_at.isoformat() if interview.created_at else None,
            }
        )

    payload = {
        "stats": await analytics.dashboard_stats(db),
        "status_counts": await interviews.status_counts(),
        "recent": recent,
    }
    _dashboard_cache = (now, payload)
    return payload


@router.get("/interviews", response_model=list[dict])
async def list_interviews(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all interviews with candidate name/email and status.

    Candidate details come from the eager-loaded relationship — no N+1.
    Served from an in-process TTL cache (invalidated on mutations) so the
    candidates page / notification bell polling never pays the ~3s remote
    DB latency on every poll.
    """
    import time as _time

    global _interviews_cache

    now = _time.monotonic()
    cached = _interviews_cache
    if cached is not None and now - cached[0] < INTERVIEWS_CACHE_TTL_SECONDS:
        return cached[1]

    repo = InterviewRepository(db)
    interviews = await repo.list_all_summary()
    result = []
    for interview in interviews:
        candidate = interview.candidate
        rec = interview.recommendation
        profile = None
        if candidate is not None and candidate.profile is not None:
            profile = {
                "skills": candidate.profile.skills,
                "education": candidate.profile.education,
                "experience": candidate.profile.experience,
                "current_company": candidate.profile.current_company,
                "profile_picture_url": candidate.profile.profile_picture_url,
            }
        result.append(
            {
                "id": str(interview.id),
                "candidate_id": str(interview.candidate_id),
                "candidate_name": candidate.full_name if candidate else "—",
                "candidate_email": candidate.email if candidate else "—",
                "candidate_profile": profile,
                "admin_status": interview.admin_status,
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

    _interviews_cache = (now, result)
    return result


@router.get("/interview/{interview_id}/meta")
async def get_interview_meta(
    interview_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get lightweight metadata for a single interview.

    Used by the admin candidate-detail page — avoids downloading the full
    interview list just to find one row. Returns the same shape as one
    entry of /api/admin/interviews.
    """
    interviews = InterviewRepository(db)
    interview = await interviews.get_meta(interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")

    candidate = interview.candidate
    rec = interview.recommendation
    profile = None
    if candidate is not None and candidate.profile is not None:
        profile = {
            "skills": candidate.profile.skills,
            "education": candidate.profile.education,
            "experience": candidate.profile.experience,
            "current_company": candidate.profile.current_company,
            "profile_picture_url": candidate.profile.profile_picture_url,
        }
    return {
        "id": str(interview.id),
        "candidate_id": str(interview.candidate_id),
        "candidate_name": candidate.full_name if candidate else "—",
        "candidate_email": candidate.email if candidate else "—",
        "candidate_profile": profile,
        "admin_status": interview.admin_status,
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


VALID_ADMIN_STATUSES = {
    "Pending", "Processing", "Completed", "Recommended",
    "Not Recommended", "Need Further Review", "Rejected", "Selected",
}


@router.put("/interview/{interview_id}/status")
async def update_interview_status(
    interview_id: str,
    status: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update the admin review status of an interview.

    Allowed values: Pending, Processing, Completed, Recommended,
    Not Recommended, Need Further Review, Rejected, Selected.
    Saved immediately; the candidate sees it on their next refresh.
    """
    status = status.strip()
    if status not in VALID_ADMIN_STATUSES:
        raise BadRequestError(
            f"Invalid status '{status}'. Use one of: {', '.join(sorted(VALID_ADMIN_STATUSES))}."
        )

    repo = InterviewRepository(db)
    interview = await repo.get(str(interview_id))
    if interview is None:
        raise NotFoundError("Interview not found")

    previous = interview.admin_status
    await repo.update(interview_id, admin_status=status)

    await ActivityLogRepository(db).log(
        current_user.id, "status_updated", "interview", interview_id,
        {"from": previous, "to": status},
    )
    await db.commit()

    invalidate_dashboard_cache()

    return {
        "interview_id": str(interview.id),
        "admin_status": status,
        "message": f"Interview status updated to '{status}'.",
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

    invalidate_dashboard_cache()

    return RecommendationMessage(
        verdict=rec.verdict.value,
        message=reason or "Recommendation updated.",
    )


@router.get("/candidates/registered")
async def list_registered_candidates(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List active candidate accounts for the upload dropdown.

    Returns only active candidate-role users (never admins, never disabled
    accounts) so the admin can pick the interview subject without typing
    the email by hand.
    """
    users = UserRepository(db)
    candidates = await users.list_active_candidates()
    return [
        {
            "id": str(c.id),
            "full_name": c.full_name,
            "email": c.email,
        }
        for c in candidates
    ]


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

    # Best-effort cleanup of stored files (local + Supabase Storage).
    storage = LocalStorage()
    for file in interview.files:
        if file.storage_path:
            storage.delete(file.storage_path)
    if settings.SUPABASE_URL:
        try:
            from app.storage.service import SupabaseStorage

            remote = SupabaseStorage()
            for file in interview.files:
                if file.storage_path:
                    remote.delete(file.storage_path)
            # Also clean up the PDF report copy in storage if it was synced.
            for pdf in interview.pdfs:
                if pdf.storage_path:
                    remote.delete(pdf.storage_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Remote file cleanup failed for %s: %s", interview_id, exc)

    await repo.delete(str(interview_id))
    await db.commit()

    await ActivityLogRepository(db).log(
        current_user.id, "interview_deleted", "interview", interview_id
    )
    await db.commit()

    invalidate_dashboard_cache()
    return {"message": f"Interview {interview_id} deleted successfully."}


@router.delete("/candidate/{candidate_id}", status_code=200)
async def delete_candidate_by_id(
    candidate_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a candidate account and ALL of their interviews (cascade).

    The admin Candidates table shows one row per interview, so a candidate
    can appear multiple times. This endpoint removes the whole candidate —
    account, profile and every interview with its artifacts — instead of a
    single interview row.
    """
    repo = UserRepository(db)
    candidate = await repo.get(str(candidate_id))
    if candidate is None or candidate.role != UserRole.CANDIDATE:
        raise NotFoundError("Candidate not found")

    # Collect every interview owned by this candidate so we can clean up
    # stored files (local + Supabase Storage) before the DB cascade.
    interview_repo = InterviewRepository(db)
    interviews = await interview_repo.list_by_candidate_full(candidate.id)

    storage = LocalStorage()
    for interview in interviews:
        for file in interview.files:
            if file.storage_path:
                storage.delete(file.storage_path)
    if settings.SUPABASE_URL:
        try:
            from app.storage.service import SupabaseStorage

            remote = SupabaseStorage()
            for interview in interviews:
                for file in interview.files:
                    if file.storage_path:
                        remote.delete(file.storage_path)
                for pdf in interview.pdfs:
                    if pdf.storage_path:
                        remote.delete(pdf.storage_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Remote file cleanup failed for candidate %s: %s", candidate_id, exc)

    # Best-effort cleanup of the Supabase Auth account so the candidate
    # can no longer sign in (the local users row is just our mirror; the
    # actual credentials live in Supabase Auth).
    if candidate.auth_uid:
        try:
            get_supabase_service().auth.admin.delete_user(str(candidate.auth_uid))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Supabase auth user cleanup failed for %s: %s", candidate_id, exc)

    # Deletes cascade to candidate_profiles and interviews (with their artifacts).
    await repo.delete(candidate.id)
    await db.commit()

    await ActivityLogRepository(db).log(
        current_user.id,
        "candidate_deleted",
        "user",
        str(candidate.id),
        {"email": candidate.email},
    )
    await db.commit()

    invalidate_dashboard_cache()
    return {"message": f"Candidate '{candidate.email}' and all interviews deleted successfully."}
