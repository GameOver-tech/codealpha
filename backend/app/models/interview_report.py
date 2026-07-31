"""Interview report — full professional evaluation narrative."""
import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class InterviewReport(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "interview_reports"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    executive_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    interview_overview: Mapped[str] = mapped_column(Text, default="", nullable=False)
    candidate_overview: Mapped[str] = mapped_column(Text, default="", nullable=False)
    performance_analysis: Mapped[str] = mapped_column(Text, default="", nullable=False)
    technical_assessment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    communication_assessment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    confidence_assessment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    problem_solving_assessment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    experience_assessment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    improvement_suggestions: Mapped[str] = mapped_column(Text, default="", nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="report")  # noqa: F821
