"""Interview scores — 0-100 per dimension + overall percentage."""
import uuid

from sqlalchemy import Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class InterviewScores(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "interview_scores"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    technical_skills: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    communication: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    problem_solving: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    relevant_experience: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    leadership: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    teamwork: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    critical_thinking: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    behavior: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    professionalism: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # weighted average %

    interview: Mapped["Interview"] = relationship(back_populates="scores")  # noqa: F821

    @property
    def score_map(self) -> dict[str, float]:
        return {
            "technical_skills": self.technical_skills,
            "communication": self.communication,
            "confidence": self.confidence,
            "problem_solving": self.problem_solving,
            "relevant_experience": self.relevant_experience,
            "leadership": self.leadership,
            "teamwork": self.teamwork,
            "critical_thinking": self.critical_thinking,
            "behavior": self.behavior,
            "professionalism": self.professionalism,
            "overall_score": self.overall_score,
        }
