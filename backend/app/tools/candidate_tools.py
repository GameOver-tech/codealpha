"""Candidate tool handlers for the AI assistant.

Candidates only ever access their own data — never admin data, scores,
feedback, transcripts, or reports (those are admin-only by platform policy).
All handlers verify the signed-in user's ownership directly.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.user import User
from app.repositories.activity_log import ActivityLogRepository
from app.repositories.candidate_profile import CandidateProfileRepository
from app.repositories.interview import InterviewRepository
from app.utils.exceptions import NotFoundError
from app.utils.recommendation_messages import get_recommendation_message


async def get_my_profile(db: AsyncSession, actor: User, **args) -> dict:
    repo = CandidateProfileRepository(db)
    profile = await repo.get_by_user(actor.id)
    if profile is None:
        return {
            "name": actor.full_name,
            "email": actor.email,
            "message": "No profile details yet. Add experience, skills and education from your profile page.",
        }
    return {
        "name": actor.full_name,
        "email": actor.email,
        "experience": profile.experience,
        "skills": profile.skills,
        "education": profile.education,
        "current_company": profile.current_company,
        "expected_salary": profile.expected_salary,
    }


async def get_my_interviews(db: AsyncSession, actor: User, **args) -> dict:
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(actor.id)
    items = []
    for interview in interviews:
        rec = interview.recommendation
        items.append(
            {
                "id": str(interview.id),
                "title": interview.title,
                "job_title": interview.job_title,
                "status": interview.status.value,
                "admin_status": interview.admin_status,
                "recommendation": rec.verdict.value if rec else None,
                "created_at": interview.created_at.isoformat() if interview.created_at else None,
                "completed_at": (
                    interview.completed_at.isoformat() if interview.completed_at else None
                ),
                "failure_reason": interview.failure_reason or None,
            }
        )
    return {"total": len(items), "items": items}


async def get_my_result(db: AsyncSession, actor: User, **args) -> dict:
    """Candidate's latest interview result — verdict + friendly message only."""
    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(actor.id)
    if not interviews:
        return {"message": "You don't have any interviews yet."}

    interview = await repo.get_full(interviews[0].id)
    rec = interview.recommendation
    verdict = rec.verdict.value if rec else None
    return {
        "interview_id": str(interview.id),
        "job_title": interview.job_title,
        "status": interview.status.value,
        "admin_status": interview.admin_status,
        "recommendation": verdict,
        "message": get_recommendation_message(verdict) if rec else "",
    }


async def get_my_learning_plan(db: AsyncSession, actor: User, **args) -> dict:
    """Deterministic learning plan from the candidate's own profile + interviews."""
    profile_repo = CandidateProfileRepository(db)
    profile = await profile_repo.get_by_user(actor.id)
    skills = [s.strip() for s in (profile.skills if profile else "").split(",") if s.strip()]

    repo = InterviewRepository(db)
    interviews = await repo.list_by_candidate(actor.id)

    strengths: list[str] = []
    weaknesses: list[str] = []
    for interview in interviews:
        full = await repo.get_full(interview.id)
        if full:
            strengths.extend(s.text for s in full.strengths)
            weaknesses.extend(w.text for w in full.weaknesses)

    plan = {
        "skills": skills,
        "strengths": strengths[:10],
        "areas_to_improve": weaknesses[:10],
        "recommendation": "Focus on the areas above; practice with mock interviews "
        "and revisit foundational concepts in your weakest skills.",
    }
    if not strengths and not weaknesses:
        plan["recommendation"] = (
            "Complete an interview to get a personalized learning plan."
        )
    return plan


async def get_my_notifications(db: AsyncSession, actor: User, **args) -> dict:
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


_FAQ = {
    "interview": "After you complete your interview, the recording is processed "
    "automatically. Check 'Interview Status' for the latest state.",
    "result": "Your result shows your hiring recommendation. Detailed scores and "
    "reports are shared by your recruiter.",
    "reschedule": "To reschedule an interview, please contact your recruiter or "
    "support — interviews are scheduled by the hiring team.",
    "account": "You can update your profile and change your password from the "
    "Settings page.",
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
    return {"items": matches or [{"topic": query, "answer": "No FAQ match found. Try asking about interviews, results, rescheduling, account, password, or resume."}]}


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


async def get_my_resume(db: AsyncSession, actor: User, **args) -> dict:
    repo = CandidateProfileRepository(db)
    profile = await repo.get_by_user(actor.id)
    if profile is None or not profile.resume_url:
        raise NotFoundError("No resume on file yet.")
    return {"resume_url": profile.resume_url, "filename": profile.resume_url.split("/")[-1]}
