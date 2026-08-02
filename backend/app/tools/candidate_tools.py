"""Candidate tool handlers for the AI assistant.

Candidates only ever access their own data, and only these four things:
1. Their awaiting interview status and time (never interview questions/content).
2. Their final result (verdict + friendly message only — scores, feedback,
   transcripts and reports are admin-only by platform policy).
3. FAQ answers.
4. Contacting support to resolve issues.

There is deliberately NO tool for profile, skills, interview content, or any
admin-authority data — those live outside the candidate scope.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.interview import InterviewStatus
from app.models.user import User
from app.repositories.activity_log import ActivityLogRepository
from app.repositories.interview import InterviewRepository
from app.utils.recommendation_messages import get_recommendation_message


async def get_my_interview_status(db: AsyncSession, actor: User, **args) -> dict:
    """Awaiting interview status + time, and whether it is still pending.

    Never exposes interview questions, content, or internal details — just
    what the candidate is waiting on.
    """
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(actor.id)
    if not interviews:
        return {
            "has_interview": False,
            "message": "You don't have an interview scheduled yet. "
            "When your interview is uploaded, you'll see its status here.",
        }

    interview = interviews[0]  # most recent
    status = interview.status.value
    is_pending = status in (InterviewStatus.UPLOADED.value, InterviewStatus.PROCESSING.value)

    started = interview.started_at.isoformat() if interview.started_at else None
    created = interview.created_at.isoformat() if interview.created_at else None

    if is_pending:
        message = (
            "Your interview is being processed. Please wait — your result will "
            "appear here as soon as the review is complete."
        )
    elif status == InterviewStatus.FAILED.value:
        message = (
            "There was an issue processing your interview. Please contact "
            "support and we'll resolve it for you."
        )
    elif interview.recommendation:
        message = "Your interview is complete — you can view your result."
    else:
        message = "Your interview is complete — your result is being finalized."

    return {
        "has_interview": True,
        "interview_id": str(interview.id),
        "status": status,
        "interview_type": interview.interview_type or "recorded",
        "awaiting": is_pending,
        "awaiting_time_seconds": interview.duration_seconds,
        "created_at": created,
        "started_at": started,
        "completed_at": interview.completed_at.isoformat() if interview.completed_at else None,
        "message": message,
    }


async def can_start_live_interview(db: AsyncSession, actor: User, **args) -> dict:
    """Whether the signed-in candidate may start a new live AI interview.

    A candidate can start when they have no interview, or their latest one
    is completed/failed. An interview that is still pending (uploaded,
    processing, transcribing, evaluating, generating PDF) blocks a new session.
    """
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(actor.id)
    if not interviews:
        return {
            "can_start": True,
            "has_interview": False,
            "message": "You can start your live AI interview now.",
        }
    interview = interviews[0]
    blocked = {
        InterviewStatus.UPLOADED.value,
        InterviewStatus.PROCESSING.value,
        InterviewStatus.TRANSCRIPT_READY.value,
        InterviewStatus.AI_EVALUATION.value,
        InterviewStatus.PDF_GENERATED.value,
    }
    if interview.status.value in blocked:
        return {
            "can_start": False,
            "has_interview": True,
            "status": interview.status.value,
            "message": "You already have an interview in progress. Please wait for it to complete before starting a new one.",
        }
    return {
        "can_start": True,
        "has_interview": True,
        "status": interview.status.value,
        "message": "You can start a new live AI interview.",
    }


async def get_my_result(db: AsyncSession, actor: User, **args) -> dict:
    """Candidate's final result — verdict + friendly message only."""
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(actor.id)
    if not interviews:
        return {"has_result": False, "message": "You don't have any interview results yet."}

    interview = interviews[0]
    rec = interview.recommendation
    if interview.status.value != InterviewStatus.COMPLETED.value and not rec:
        return {
            "has_result": False,
            "status": interview.status.value,
            "message": "Your interview is still being processed. Please check back later.",
        }
    verdict = rec.verdict.value if rec else None
    return {
        "has_result": True,
        "interview_id": str(interview.id),
        "job_title": interview.job_title,
        "status": interview.status.value,
        "admin_status": interview.admin_status,
        "recommendation": verdict,
        "message": get_recommendation_message(verdict) if rec else "",
    }


_FAQ = {
    "interview": "After you complete your interview, the recording is processed "
    "automatically. Check 'Interview Status' for the latest state.",
    "result": "Your result shows your hiring recommendation. Detailed scores and "
    "reports are shared by your recruiter.",
    "reschedule": "To reschedule an interview, please contact your recruiter or "
    "support — interviews are scheduled by the hiring team.",
    "account": "You can update your account details from the Settings page.",
    "password": "Go to Settings → Change password, or use 'Forgot password' on the "
    "login page.",
    "resume": "Upload your resume from the profile page; it helps recruiters "
    "review your application.",
}


async def faq_search(db: AsyncSession, actor: User, **args) -> dict:
    query = (args.get("query") or "").strip().lower()
    if not query:
        return {"items": [{"topic": k, "answer": v} for k, v in _FAQ.items()]}
    matches = [
        {"topic": key, "answer": value}
        for key, value in _FAQ.items()
        if query in key or query in value.lower()
    ]
    return {
        "items": matches
        or [
            {
                "topic": query,
                "answer": "No FAQ match found. Try asking about interviews, results, rescheduling, account, password, or resume.",
            }
        ]
    }


async def contact_support(db: AsyncSession, actor: User, **args) -> dict:
    message = (args.get("message") or "").strip()
    if not message:
        from app.utils.exceptions import BadRequestError

        raise BadRequestError("message is required")

    await ActivityLogRepository(db).log(
        actor.id,
        "support_request",
        "user",
        str(actor.id),
        {"message": message[:500]},
    )
    await db.commit()
    return {"status": "submitted", "message": "Your support request has been submitted."}


async def get_my_notifications(db: AsyncSession, actor: User, **args) -> dict:
    """Candidate's own notifications (status updates, support replies)."""
    stmt = (
        select(ActivityLog)
        .where(ActivityLog.entity_id == str(actor.id))
        .order_by(ActivityLog.created_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    logs = list(result.scalars().all())
    return {
        "total": len(logs),
        "items": [
            {
                "action": log.action,
                "details": log.details or {},
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
