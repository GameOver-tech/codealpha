"""Recommendation model — the hiring decision (one of three)."""
import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class RecommendationVerdict(str, enum.Enum):
    RECOMMENDED = "Recommended"
    NOT_RECOMMENDED = "Not Recommended"
    NEED_FURTHER_REVIEW = "Need Further Review"


class Recommendation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "recommendations"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    verdict: Mapped[RecommendationVerdict] = mapped_column(
        Enum(
            RecommendationVerdict,
            name="recommendation_verdict",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, default="", nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="recommendation")  # noqa: F821
