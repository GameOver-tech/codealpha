"""Admin tool handlers for the AI assistant.

Every handler receives the acting User and the request args, returns a
JSON-serializable dict, and performs its own role check (defense in depth —
the registry already restricts exposure). Write actions are audited to
activity_logs. All enforcement lives here, never in the LLM.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.logging import get_logger
from app.core.supabase_client import get_supabase_service
from app.models.user import User, UserRole
from app.repositories.activity_log import ActivityLogRepository
from app.repositories.candidate_profile import CandidateProfileRepository
from app.repositories.interview import InterviewRepository
from app.repositories.user import UserRepository
from app.tools import analytics
from app.utils.exceptions import BadRequestError, NotFoundError

logger = get_logger(__name__)

VALID_ADMIN_STATUSES = {
    "Pending", "Processing", "Completed", "Recommended",
    "Not Recommended", "Need Further Review", "Rejected", "Selected",
}


def _require_admin(actor: User) -> None:
    if actor.role.value != "admin":
        from app.utils.exceptions import ForbiddenError

        raise ForbiddenError("Requires admin role")


def _serialize_interview(interview) -> dict:
    rec = interview.recommendation
    candidate = interview.candidate
    profile = candidate.profile if candidate else None
    tech = interview.technical_evaluation
    scores = interview.scores
    tech_dict = None
    if tech is not None:
        from sqlalchemy import inspect

        tech_dict = {
            c.key: getattr(tech, c.key)
            for c in inspect(tech).mapper.column_attrs
            if c.key not in ("id", "interview_id", "created_at", "updated_at")
        }
    return {
        "id": str(interview.id),
        "candidate_id": str(interview.candidate_id) if interview.candidate_id else None,
        "candidate_name": candidate.full_name if candidate else None,
        "candidate_email": candidate.email if candidate else None,
        "skills": profile.skills if profile else None,
        "job_title": interview.job_title,
        "status": interview.status.value,
        "admin_status": interview.admin_status,
        "overall_score": scores.overall_score if scores else None,
        "scores": scores.score_map if scores else None,
        "recommendation": rec.verdict.value if rec else None,
        "recommendation_reason": rec.reason if rec else None,
        "technical_evaluation": tech_dict,
        "strengths": [s.text for s in interview.strengths],
        "weaknesses": [w.text for w in interview.weaknesses],
        "duration_seconds": interview.duration_seconds,
        "created_at": interview.created_at.isoformat() if interview.created_at else None,
        "completed_at": interview.completed_at.isoformat() if interview.completed_at else None,
    }


# --- Dashboard --------------------------------------------------------------


async def get_dashboard_stats(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    return await analytics.dashboard_stats(db)


# --- Candidates -------------------------------------------------------------


async def list_candidates(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    search = (args.get("search") or "").strip().lower()
    limit = min(int(args.get("limit") or 50), 100)
    offset = int(args.get("offset") or 0)

    repo = UserRepository(db)
    # Eager-load profile — accessing user.profile in an async session without
    # it raises MissingGreenlet (lazy-load is impossible across await).
    stmt = (
        select(User)
        .where(User.role == UserRole.CANDIDATE)
        .options(joinedload(User.profile))
    )
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(
                User.email.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
            )
        )
    stmt = stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    users = list(result.scalars().all())

    items = []
    for user in users:
        profile = user.profile
        items.append(
            {
                "id": str(user.id),
                "email": user.email,
                "name": user.full_name,
                "phone": user.phone,
                "gender": user.gender,
                "is_active": user.is_active,
                "skills": profile.skills if profile else None,
                "education": profile.education if profile else None,
                "experience": profile.experience if profile else None,
                "current_company": profile.current_company if profile else None,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }
        )
    return {"total": len(items), "items": items}


async def get_candidate(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    if not email:
        raise BadRequestError("email is required")
    repo = UserRepository(db)
    # Eager-load profile — async sessions cannot lazy-load across await.
    stmt = (
        select(User)
        .where(User.email == email)
        .options(joinedload(User.profile))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None or user.role != UserRole.CANDIDATE:
        raise NotFoundError(f"No candidate found with email '{email}'")
    profile = user.profile
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "phone": user.phone,
        "gender": user.gender,
        "is_active": user.is_active,
        "skills": profile.skills if profile else None,
        "education": profile.education if profile else None,
        "experience": profile.experience if profile else None,
        "current_company": profile.current_company if profile else None,
        "expected_salary": profile.expected_salary if profile else None,
        "resume_url": profile.resume_url if profile else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def update_candidate(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    if not email:
        raise BadRequestError("email is required")
    repo = UserRepository(db)
    user = await repo.get_by_email(email)
    if user is None or user.role != UserRole.CANDIDATE:
        raise NotFoundError(f"No candidate found with email '{email}'")

    updated = {}
    if args.get("first_name"):
        user.first_name = args["first_name"]
        updated["first_name"] = args["first_name"]
    if args.get("last_name"):
        user.last_name = args["last_name"]
        updated["last_name"] = args["last_name"]
    if args.get("phone") is not None:
        user.phone = args["phone"]
        updated["phone"] = args["phone"]
    if args.get("gender") is not None:
        user.gender = args["gender"]
        updated["gender"] = args["gender"]
    if args.get("is_active") is not None:
        user.is_active = bool(args["is_active"])
        updated["is_active"] = user.is_active
        # Active-flag changes must be visible immediately — drop the cached
        # user so the next request re-reads from the DB.
        from app.dependencies.auth import invalidate_user_cache

        invalidate_user_cache(str(user.auth_uid) if user.auth_uid else None)

    profile_data = {}
    for key in ("experience", "skills", "education", "current_company", "expected_salary"):
        if args.get(key) is not None:
            profile_data[key] = args[key]
    if profile_data:
        await CandidateProfileRepository(db).upsert(user.id, profile_data)
        updated.update(profile_data)

    await db.flush()
    return {"email": user.email, "updated": updated}


async def delete_candidate(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    if not email:
        raise BadRequestError("email is required")
    repo = UserRepository(db)
    user = await repo.get_by_email(email)
    if user is None or user.role != UserRole.CANDIDATE:
        raise NotFoundError(f"No candidate found with email '{email}'")

    # Best-effort cleanup of the Supabase Auth account so the candidate
    # can no longer sign in (the local users row is just our mirror; the
    # actual credentials live in Supabase Auth).
    if user.auth_uid:
        try:
            get_supabase_service().auth.admin.delete_user(str(user.auth_uid))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Supabase auth user cleanup failed for %s: %s", user.email, exc)

    # Deletes cascade to candidate_profiles and interviews (with their artifacts).
    await repo.delete(user.id)
    await ActivityLogRepository(db).log(
        actor.id,
        "candidate_deleted",
        "user",
        str(user.id),
        {"email": user.email},
    )
    await db.commit()
    # Chat mutations must invalidate the admin caches too — the dashboard /
    # candidates list / analysis bundles are served from TTL caches.
    from app.routers.admin import invalidate_dashboard_cache

    invalidate_dashboard_cache()
    return {"message": f"Candidate '{email}' deleted."}


async def create_candidate(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    password = args.get("password") or ""
    first_name = args.get("first_name") or ""
    last_name = args.get("last_name") or ""
    if not email or not password:
        raise BadRequestError("email and password are required")

    existing = await UserRepository(db).get_by_email(email)
    if existing:
        raise BadRequestError(f"A user with email '{email}' already exists")

    try:
        sb = get_supabase_service()
        created = sb.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        )
        auth_uid = created.user.id
    except Exception as exc:  # noqa: BLE001
        logger.warning("Supabase create_user failed for %s: %s", email, exc)
        raise BadRequestError(
            f"Could not create Supabase auth user for '{email}'. "
            "The email may already be registered."
        )

    try:
        sb.table("profiles").insert(
            {
                "id": auth_uid,
                "email": email,
                "role": "candidate",
                "full_name": f"{first_name} {last_name}".strip(),
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not write legacy profiles row for %s: %s", email, exc)

    user = await UserRepository(db).create_candidate(
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=args.get("phone") or "",
        gender=args.get("gender") or "",
        auth_uid=auth_uid,
    )
    await ActivityLogRepository(db).log(
        actor.id,
        "candidate_created",
        "user",
        str(user.id),
        {"email": email},
    )
    await db.commit()
    from app.routers.admin import invalidate_dashboard_cache

    invalidate_dashboard_cache()
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "message": f"Candidate '{email}' created.",
    }


# --- Interviews -------------------------------------------------------------


async def list_interviews(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    status = (args.get("status") or "").strip().lower()
    limit = min(int(args.get("limit") or 50), 100)
    offset = int(args.get("offset") or 0)

    repo = InterviewRepository(db)
    interviews = await repo.list_for_chat(limit=limit, offset=offset)
    if status:
        interviews = [i for i in interviews if i.status.value == status]
    return {"total": len(interviews), "items": [_serialize_interview(i) for i in interviews]}


async def get_candidate_results(db: AsyncSession, actor: User, **args) -> dict:
    """Interview results for a candidate (by email) — tabular, admin-only."""
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    if not email:
        raise BadRequestError("email is required")

    repo = UserRepository(db)
    candidate = await repo.get_by_email(email)
    if candidate is None or candidate.role != UserRole.CANDIDATE:
        raise NotFoundError(f"No candidate found with email '{email}'")

    interviews = InterviewRepository(db)
    items = [_serialize_interview(i) for i in await interviews.list_for_chat_by_candidate(candidate.id)]
    return {
        "candidate_email": candidate.email,
        "candidate_name": candidate.full_name,
        "total_results": len(items),
        "items": items,
    }


async def get_interview_details(db: AsyncSession, actor: User, **args) -> dict:
    """Full analysis for one interview: transcript, technical evaluation,
    sentiment, speech, scores, strengths/weaknesses, recommendation, report."""
    _require_admin(actor)
    interview_id = str(args.get("interview_id") or "").strip()
    if not interview_id:
        raise BadRequestError("interview_id is required")

    interviews = InterviewRepository(db)
    interview = await interviews.get_full(interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")

    tech_dict = None
    if interview.technical_evaluation is not None:
        from sqlalchemy import inspect

        tech_dict = {
            c.key: getattr(interview.technical_evaluation, c.key)
            for c in inspect(interview.technical_evaluation).mapper.column_attrs
            if c.key not in ("id", "interview_id", "created_at", "updated_at")
        }

    report_dict = None
    if interview.report is not None:
        from sqlalchemy import inspect

        report_dict = {
            c.key: getattr(interview.report, c.key)
            for c in inspect(interview.report).mapper.column_attrs
            if c.key not in ("id", "interview_id", "created_at", "updated_at")
        }

    rec = interview.recommendation
    return {
        "interview": _serialize_interview(interview),
        "transcript": interview.transcript.full_text if interview.transcript else None,
        "technical_evaluation": tech_dict,
        "sentiment_analysis": {
            "sentiment": interview.sentiment_analysis.sentiment,
            "emotion": interview.sentiment_analysis.emotion,
            "professionalism": interview.sentiment_analysis.professionalism,
            "summary": interview.sentiment_analysis.summary,
        }
        if interview.sentiment_analysis
        else None,
        "speech_analysis": {
            "speech_speed_wpm": interview.speech_analysis.speech_speed_wpm,
            "clarity": interview.speech_analysis.clarity,
            "fluency": interview.speech_analysis.fluency,
            "energy": interview.speech_analysis.energy,
        }
        if interview.speech_analysis
        else None,
        "recommendation": {
            "verdict": rec.verdict.value,
            "reason": rec.reason,
        }
        if rec
        else None,
        "report": report_dict,
    }


async def update_interview_status(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    interview_id = str(args.get("interview_id") or "").strip()
    status = str(args.get("status") or "").strip()
    if not interview_id or not status:
        raise BadRequestError("interview_id and status are required")
    if status not in VALID_ADMIN_STATUSES:
        raise BadRequestError(
            f"Invalid status '{status}'. Use one of: {', '.join(sorted(VALID_ADMIN_STATUSES))}."
        )

    repo = InterviewRepository(db)
    interview = await repo.get(interview_id)
    if interview is None:
        raise NotFoundError("Interview not found")

    previous = interview.admin_status
    await repo.update(interview_id, admin_status=status)

    # Statuses that are also hiring verdicts must update the recommendation
    # row too — the candidate-facing dashboard/result reads the verdict from
    # the recommendations table, so "Recommended" / "Not Recommended" /
    # "Need Further Review" set here must be visible on the candidate side.
    from app.models.recommendation import RecommendationVerdict

    verdict_statuses = {
        "Recommended": RecommendationVerdict.RECOMMENDED,
        "Not Recommended": RecommendationVerdict.NOT_RECOMMENDED,
        "Need Further Review": RecommendationVerdict.NEED_FURTHER_REVIEW,
    }
    if status in verdict_statuses:
        from app.repositories.analysis import RecommendationRepository

        await RecommendationRepository(db).upsert(
            interview_id, verdict_statuses[status], f"Set via status update to '{status}'."
        )

    await ActivityLogRepository(db).log(
        actor.id,
        "status_updated",
        "interview",
        interview_id,
        {"from": previous, "to": status},
    )
    await db.commit()
    from app.routers.admin import invalidate_dashboard_cache

    invalidate_dashboard_cache()
    return {"interview_id": str(interview.id), "admin_status": status}


async def send_interview_result_email(db: AsyncSession, actor: User, **args) -> dict:
    """Send the candidate's interview result via email.

    Resolves the candidate by email, takes their most recent completed
    interview, and emails the result (status, recommendation, message).
    """
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    if not email:
        raise BadRequestError("email is required")

    users = UserRepository(db)
    candidate = await users.get_by_email(email)
    if candidate is None or candidate.role != UserRole.CANDIDATE:
        raise NotFoundError(f"No candidate found with email '{email}'")

    interviews = InterviewRepository(db)
    items = await interviews.list_by_candidate(candidate.id)
    if not items:
        raise NotFoundError(f"Candidate '{email}' has no interviews yet.")

    interview = items[0]
    rec = interview.recommendation
    verdict = rec.verdict.value if rec else None

    from app.services.email_service import send_result_email
    from app.utils.recommendation_messages import get_recommendation_message

    outcome = send_result_email(
        to_email=candidate.email,
        candidate_name=candidate.full_name,
        job_title=interview.job_title,
        status=interview.status.value,
        verdict=verdict or "",
        message=get_recommendation_message(verdict) if rec else "",
    )

    await ActivityLogRepository(db).log(
        actor.id,
        "result_email_sent",
        "interview",
        str(interview.id),
        {"email": candidate.email, "status": outcome["status"], "verdict": verdict},
    )
    await db.commit()

    return {
        "candidate_email": candidate.email,
        "candidate_name": candidate.full_name,
        "job_title": interview.job_title,
        "status": interview.status.value,
        "recommendation": verdict,
        "email_status": outcome["status"],
        "detail": outcome["detail"],
    }


# --- Analytics --------------------------------------------------------------


async def get_analytics(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    months = min(int(args.get("months") or 6), 24)
    funnel = await analytics.hiring_funnel(db)
    return {
        "funnel": funnel,
        # Derived from the funnel counts — no duplicate DB round trips.
        "success_rate": funnel["success_rate"],
        "avg_duration_seconds": await analytics.avg_duration_seconds(db),
        "monthly_trends": await analytics.monthly_trends(db, months=months),
    }


# --- Users ------------------------------------------------------------------


async def list_users(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    role = (args.get("role") or "").strip().lower()
    limit = min(int(args.get("limit") or 50), 100)
    offset = int(args.get("offset") or 0)

    repo = UserRepository(db)
    stmt = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if role:
        stmt = select(User).where(User.role == UserRole(role)).order_by(
            User.created_at.desc()
        ).limit(limit).offset(offset)
    result = await db.execute(stmt)
    users = list(result.scalars().all())
    return {
        "total": len(users),
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "name": u.full_name,
                "role": u.role.value,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


async def change_role(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    role = (args.get("role") or "").strip().lower()
    if not email or role not in ("admin", "candidate"):
        raise BadRequestError("email and role ('admin' | 'candidate') are required")
    if email == actor.email:
        raise BadRequestError("You cannot change your own role")

    repo = UserRepository(db)
    user = await repo.get_by_email(email)
    if user is None:
        raise NotFoundError(f"No user found with email '{email}'")

    new_role = UserRole(role)
    await repo.set_role(user.id, new_role)
    await ActivityLogRepository(db).log(
        actor.id,
        "role_changed",
        "user",
        str(user.id),
        {"from": user.role.value, "to": role},
    )
    await db.commit()
    # Role changes must take effect immediately — drop the cached user row.
    from app.dependencies.auth import invalidate_user_cache

    invalidate_user_cache(str(user.auth_uid) if user.auth_uid else None)
    from app.routers.admin import invalidate_dashboard_cache

    invalidate_dashboard_cache()
    return {"email": user.email, "role": role}


# --- Notifications & logs ---------------------------------------------------


async def send_notification(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    email = (args.get("email") or "").strip().lower()
    message = (args.get("message") or "").strip()
    if not email or not message:
        raise BadRequestError("email and message are required")

    repo = UserRepository(db)
    user = await repo.get_by_email(email)
    if user is None:
        raise NotFoundError(f"No user found with email '{email}'")

    # Record-only: no SMTP integration exists yet. The notification is
    # persisted to the audit log so it can be delivered by a future worker.
    await ActivityLogRepository(db).log(
        actor.id,
        "notification_sent",
        "user",
        str(user.id),
        {"email": email, "message": message[:500]},
    )
    await db.commit()
    return {
        "status": "queued",
        "email": email,
        "message": "Notification recorded (delivery integration is not configured yet).",
    }


async def get_system_logs(db: AsyncSession, actor: User, **args) -> dict:
    _require_admin(actor)
    limit = min(int(args.get("limit") or 25), 100)
    action = (args.get("action") or "").strip()

    from app.models.activity_log import ActivityLog

    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
    if action:
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.action.ilike(f"%{action}%"))
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
    result = await db.execute(stmt)
    logs = list(result.scalars().all())
    return {
        "total": len(logs),
        "items": [
            {
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "details": log.details or {},
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }


async def get_recent_activity(db: AsyncSession, actor: User, **args) -> dict:
    """Recent platform activity (new interviews, status changes, support
    requests, candidate actions) — the audit trail, newest first."""
    _require_admin(actor)
    limit = min(int(args.get("limit") or 20), 100)

    from app.models.activity_log import ActivityLog

    stmt = (
        select(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = list(result.scalars().all())
    return {
        "total": len(logs),
        "items": [
            {
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "details": log.details or {},
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
