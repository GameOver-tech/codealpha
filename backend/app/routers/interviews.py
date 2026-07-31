"""Candidate interview endpoints — status + final result (view-only).

Candidates NEVER upload recordings, trigger processing, or download the
report PDF. They can only see the interview status and the recommendation
verdict; the full report is admin-only.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.repositories.interview import InterviewRepository
from app.schemas.interview import (
    CandidateSummary,
    InterviewStatusOut,
)
from app.utils.exceptions import ForbiddenError, NotFoundError
from app.utils.recommendation_messages import get_recommendation_message

logger = get_logger(__name__)

router = APIRouter(prefix="/api/interview", tags=["Candidate"])


def _status_out(interview) -> InterviewStatusOut:
    rec = interview.recommendation
    return InterviewStatusOut(
        id=str(interview.id),
        title=interview.title,
        status=interview.status.value,
        admin_status=interview.admin_status,
        job_title=interview.job_title,
        created_at=interview.created_at,
        updated_at=interview.updated_at,
        duration_seconds=interview.duration_seconds,
        error_message=interview.error_message,
        failure_reason=interview.failure_reason,
        failure_stage=interview.failure_stage,
        processing_finished_at=interview.processing_finished_at,
        recommendation=rec.verdict.value if rec else None,
    )


async def _owned_interview(
    db: AsyncSession, user: User, interview_id: str, *, allow_admin: bool = False
):
    repo = InterviewRepository(db)
    interview = await repo.get_full(interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")
    is_admin = user.role.value == "admin"
    if not (is_admin and allow_admin) and interview.candidate_id != user.id:
        raise ForbiddenError("Not authorized to access this interview")
    return interview


@router.get("/status", response_model=InterviewStatusOut)
async def get_interview_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the status of the candidate's most recent interview."""
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(current_user.id)
    if not interviews:
        raise NotFoundError("No interview found for this candidate")
    interview = await repo.get_full(interviews[0].id)
    return _status_out(interview)


@router.get("/result", response_model=CandidateSummary)
async def get_interview_result(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the candidate's result — status + hiring recommendation only.

    Candidates never receive scores, transcripts, or the full report; those
    are admin-only. They see the recommendation verdict and a friendly message.
    """
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(current_user.id)
    if not interviews:
        raise NotFoundError("No interview found for this candidate")

    interview = await repo.get_full(interviews[0].id)

    rec = interview.recommendation
    verdict = rec.verdict.value if rec else None
    message = get_recommendation_message(rec.verdict.value) if rec else ""

    return CandidateSummary(
        interview_id=str(interview.id),
        status=interview.status.value,
        admin_status=interview.admin_status,
        candidate_name=current_user.full_name,
        candidate_email=current_user.email,
        interview_date=interview.completed_at or interview.created_at,
        recommendation=verdict,
        message=message,
    )


@router.get("/result/pdf")
async def get_interview_result_pdf(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Candidate PDF download — admin-only.

    Candidates are not allowed to download the report PDF. Only admins can
    generate/download the professional report via the admin endpoints.
    """
    raise ForbiddenError(
        "Candidates cannot download the report. Please contact your recruiter."
    )
