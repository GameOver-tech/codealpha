"""Technical evaluation — free-text dimension analyses from the LLM."""
import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class TechnicalEvaluation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "technical_evaluation"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    technical_knowledge: Mapped[str] = mapped_column(Text, default="", nullable=False)
    communication_skills: Mapped[str] = mapped_column(Text, default="", nullable=False)
    confidence_level: Mapped[str] = mapped_column(Text, default="", nullable=False)
    problem_solving: Mapped[str] = mapped_column(Text, default="", nullable=False)
    relevant_experience: Mapped[str] = mapped_column(Text, default="", nullable=False)
    leadership: Mapped[str] = mapped_column(Text, default="", nullable=False)
    teamwork: Mapped[str] = mapped_column(Text, default="", nullable=False)
    critical_thinking: Mapped[str] = mapped_column(Text, default="", nullable=False)
    behavior: Mapped[str] = mapped_column(Text, default="", nullable=False)
    professionalism: Mapped[str] = mapped_column(Text, default="", nullable=False)
    answer_quality: Mapped[str] = mapped_column(Text, default="", nullable=False)
    answer_accuracy: Mapped[str] = mapped_column(Text, default="", nullable=False)
    depth_of_knowledge: Mapped[str] = mapped_column(Text, default="", nullable=False)
    domain_expertise: Mapped[str] = mapped_column(Text, default="", nullable=False)
    soft_skills: Mapped[str] = mapped_column(Text, default="", nullable=False)
    overall_performance: Mapped[str] = mapped_column(Text, default="", nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="technical_evaluation")  # noqa: F821
