"""Candidate interview endpoints — status + final result (view-only).

Candidates NEVER upload recordings or trigger processing; they can only see
the interview status and the generated result (including the PDF).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import Response

from app.core.database import get_db
from app.core.logging import get_logger
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.repositories.interview import InterviewRepository
from app.schemas.interview import (
    InterviewResult,
    InterviewStatusOut,
    PdfMeta,
    RecommendationOut,
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
        job_title=interview.job_title,
        created_at=interview.created_at,
        updated_at=interview.updated_at,
        duration_seconds=interview.duration_seconds,
        error_message=interview.error_message,
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


@router.get("/result", response_model=InterviewResult)
async def get_interview_result(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full generated interview result (view-only for candidates)."""
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(current_user.id)
    if not interviews:
        raise NotFoundError("No interview found for this candidate")

    interview = await repo.get_full(interviews[0].id)

    scores = interview.scores
    transcript = interview.transcript
    strengths = [s.text for s in interview.strengths]
    weaknesses = [w.text for w in interview.weaknesses]
    rec = interview.recommendation
    report = interview.report
    pdf = interview.pdfs[-1] if interview.pdfs else None

    recommendation_out = None
    if rec:
        recommendation_out = RecommendationOut(
            id=str(rec.id),
            interview_id=str(rec.interview_id),
            verdict=rec.verdict.value,
            reason=rec.reason,
            message=get_recommendation_message(rec.verdict.value),
        )

    return InterviewResult(
        interview_id=str(interview.id),
        status=interview.status.value,
        candidate_name=current_user.full_name,
        candidate_email=current_user.email,
        interview_date=interview.completed_at or interview.created_at,
        duration_seconds=interview.duration_seconds,
        transcript=transcript.full_text if transcript else "",
        speech_analysis=interview.speech_analysis,
        sentiment_analysis=interview.sentiment_analysis,
        scores=scores,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendation=recommendation_out,
        report=report,
        pdf=PdfMeta(
            id=str(pdf.id), filename=pdf.filename, url=pdf.storage_path
        ) if pdf else None,
    )


@router.get("/result/pdf")
async def get_interview_result_pdf(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the generated PDF report for the candidate's latest interview."""
    from app.services.pdf_download import download_pdf_for_interview

    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(current_user.id)
    if not interviews:
        raise NotFoundError("No interview found for this candidate")
    interview = await repo.get_full(interviews[0].id)
    pdf = interview.pdfs[-1] if interview.pdfs else None
    if pdf is None:
        raise NotFoundError("PDF report not generated yet")

    data, content_type = await download_pdf_for_interview(pdf.storage_path, pdf.filename)
    return Response(content=data, media_type=content_type, headers={
        "Content-Disposition": f'attachment; filename="{pdf.filename}"'
    })
