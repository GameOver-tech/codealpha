"""Analytics helpers for the AI assistant — SQL aggregates over interviews."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interview import Interview, InterviewStatus
from app.models.interview_scores import InterviewScores
from app.models.recommendation import Recommendation, RecommendationVerdict
from app.models.user import User, UserRole


async def dashboard_stats(db: AsyncSession) -> dict:
    """High-level dashboard metrics used by get_dashboard_stats / get_analytics."""
    total_candidates = await _count(db, User, User.role == UserRole.CANDIDATE)
    interviewed = await _count(
        db,
        Interview,
        Interview.status.in_(
            [InterviewStatus.COMPLETED, InterviewStatus.PDF_GENERATED]
        ),
    )
    total_interviews = await _count(db, Interview)
    avg_score = await db.scalar(select(func.avg(InterviewScores.overall_score))) or 0.0
    return {
        "total_candidates": total_candidates,
        "total_interviews": total_interviews,
        "interviewed_candidates": interviewed,
        "processing": await _count(
            db,
            Interview,
            Interview.status.in_([InterviewStatus.PROCESSING, InterviewStatus.UPLOADED]),
        ),
        "failed": await _count(db, Interview, Interview.status == InterviewStatus.FAILED),
        "recommended": await _count(
            db, Recommendation, Recommendation.verdict == RecommendationVerdict.RECOMMENDED
        ),
        "not_recommended": await _count(
            db,
            Recommendation,
            Recommendation.verdict == RecommendationVerdict.NOT_RECOMMENDED,
        ),
        "avg_score": avg_score,
    }


async def hiring_funnel(db: AsyncSession) -> dict:
    """Pipeline funnel: registered → interviewed → recommended → selected."""
    recommended = await _count(
        db, Recommendation, Recommendation.verdict == RecommendationVerdict.RECOMMENDED
    )
    selected = await _count(
        db, Interview, Interview.admin_status == "Selected"
    )
    registered = await _count(db, User, User.role == UserRole.CANDIDATE)
    interviewed = await _count(
        db,
        Interview,
        Interview.status.in_([InterviewStatus.COMPLETED, InterviewStatus.PDF_GENERATED]),
    )
    return {
        "registered": registered,
        "interviewed": interviewed,
        "recommended": recommended,
        "selected": selected,
        "success_rate": _pct(recommended, interviewed),
        "conversion_rate": _pct(selected, interviewed),
    }


async def monthly_trends(db: AsyncSession, months: int = 6) -> list[dict]:
    """Interviews per month over the last N months."""
    now = datetime.now(timezone.utc)
    year_start = now.year
    month_start = now.month - (months - 1)
    start = datetime(year_start, max(month_start, 1), 1, tzinfo=timezone.utc)
    rows = await db.execute(
        select(
            func.date_trunc("month", Interview.created_at).label("month"),
            func.count(Interview.id).label("count"),
        )
        .where(Interview.created_at >= start)
        .group_by("month")
        .order_by("month")
    )
    return [
        {"month": row.month.isoformat() if row.month else None, "interviews": row.count}
        for row in rows
    ]


async def avg_duration_seconds(db: AsyncSession) -> float:
    value = await db.scalar(
        select(func.avg(Interview.duration_seconds)).where(
            Interview.duration_seconds > 0
        )
    )
    return round(float(value or 0.0), 1)


async def success_rate(db: AsyncSession) -> float:
    """Recommended / completed interviews, as a 0-100 percentage."""
    interviewed = await _count(
        db,
        Interview,
        Interview.status.in_([InterviewStatus.COMPLETED, InterviewStatus.PDF_GENERATED]),
    )
    recommended = await _count(
        db, Recommendation, Recommendation.verdict == RecommendationVerdict.RECOMMENDED
    )
    return _pct(recommended, interviewed)


def _pct(part: int, whole: int) -> float:
    return round((part / whole) * 100.0, 1) if whole else 0.0


async def _count(db: AsyncSession, model, *criteria) -> int:
    stmt = select(func.count(model.id))
    if criteria:
        stmt = stmt.where(*criteria)
    return int(await db.scalar(stmt) or 0)
