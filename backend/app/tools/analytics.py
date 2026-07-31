"""Analytics helpers for the AI assistant — SQL aggregates over interviews."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interview import Interview, InterviewStatus
from app.models.interview_scores import InterviewScores
from app.models.recommendation import Recommendation, RecommendationVerdict
from app.models.user import User, UserRole


def _count_where(model, label: str, *criteria) -> Any:
    """Scalar-subquery COUNT expression — lets multiple aggregates run in one query."""
    return (
        select(func.count(model.id))
        .where(*criteria)
        .scalar_subquery()
        .label(label)
    )


async def dashboard_stats(db: AsyncSession) -> dict:
    """High-level dashboard metrics used by get_dashboard_stats / get_analytics.

    Executed as a single SQL query (scalar subqueries) so the remote DB is
    hit once, not eight times (each round trip to a hosted Supabase DB
    costs ~100ms+).
    """

    row = await db.execute(
        select(
            _count_where(User, "total_candidates", User.role == UserRole.CANDIDATE),
            _count_where(Interview, "total_interviews"),
            _count_where(
                Interview,
                "interviewed",
                Interview.status.in_([InterviewStatus.COMPLETED, InterviewStatus.PDF_GENERATED]),
            ),
            _count_where(
                Interview,
                "processing",
                Interview.status.in_([InterviewStatus.PROCESSING, InterviewStatus.UPLOADED]),
            ),
            _count_where(Interview, "failed", Interview.status == InterviewStatus.FAILED),
            _count_where(
                Recommendation,
                "recommended",
                Recommendation.verdict == RecommendationVerdict.RECOMMENDED,
            ),
            _count_where(
                Recommendation,
                "not_recommended",
                Recommendation.verdict == RecommendationVerdict.NOT_RECOMMENDED,
            ),
            select(func.coalesce(func.avg(InterviewScores.overall_score), 0.0))
            .scalar_subquery()
            .label("avg_score"),
        )
    )
    r = row.one()
    return {
        "total_candidates": int(r.total_candidates),
        "total_interviews": int(r.total_interviews),
        "interviewed_candidates": int(r.interviewed),
        "processing": int(r.processing),
        "failed": int(r.failed),
        "recommended": int(r.recommended),
        "not_recommended": int(r.not_recommended),
        "avg_score": round(float(r.avg_score), 1),
    }


async def hiring_funnel(db: AsyncSession) -> dict:
    """Pipeline funnel: registered → interviewed → recommended → selected.

    Single query (scalar subqueries) instead of four round trips.
    """

    row = await db.execute(
        select(
            _count_where(User, "registered", User.role == UserRole.CANDIDATE),
            _count_where(
                Interview,
                "interviewed",
                Interview.status.in_([InterviewStatus.COMPLETED, InterviewStatus.PDF_GENERATED]),
            ),
            _count_where(
                Recommendation,
                "recommended",
                Recommendation.verdict == RecommendationVerdict.RECOMMENDED,
            ),
            _count_where(Interview, "selected", Interview.admin_status == "Selected"),
        )
    )
    r = row.one()
    registered = int(r.registered)
    interviewed = int(r.interviewed)
    recommended = int(r.recommended)
    selected = int(r.selected)
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


def _pct(part: int, whole: int) -> float:
    return round((part / whole) * 100.0, 1) if whole else 0.0
