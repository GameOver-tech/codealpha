"""Interview model — one per candidate evaluation session."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class InterviewStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    TRANSCRIPT_READY = "transcript_ready"
    AI_EVALUATION = "ai_evaluation"
    PDF_GENERATED = "pdf_generated"
    COMPLETED = "completed"
    FAILED = "failed"


class Interview(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "interviews"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="Interview", nullable=False)
    status: Mapped[InterviewStatus] = mapped_column(
        Enum(
            InterviewStatus,
            name="interview_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=InterviewStatus.UPLOADED,
        nullable=False,
    )
    job_title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    job_description: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(default=0, nullable=False)
    error_message: Mapped[str] = mapped_column(String(1000), default="", nullable=False)

    files: Mapped[list["InterviewFile"]] = relationship(
        back_populates="interview", cascade="all, delete-orphan"
    )
    candidate: Mapped["User"] = relationship(back_populates="interviews")  # noqa: F821
    transcript: Mapped["Transcript | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )
    speech_analysis: Mapped["SpeechAnalysis | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )
    sentiment_analysis: Mapped["SentimentAnalysis | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )
    technical_evaluation: Mapped["TechnicalEvaluation | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )
    scores: Mapped["InterviewScores | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )
    strengths: Mapped[list["Strength"]] = relationship(
        back_populates="interview", cascade="all, delete-orphan"
    )
    weaknesses: Mapped[list["Weakness"]] = relationship(
        back_populates="interview", cascade="all, delete-orphan"
    )
    recommendation: Mapped["Recommendation | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )
    report: Mapped["InterviewReport | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )
    pdfs: Mapped[list["GeneratedPdf"]] = relationship(
        back_populates="interview", cascade="all, delete-orphan"
    )
