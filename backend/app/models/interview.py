"""Interview model — one per candidate evaluation session."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, String
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
    # Competencies the AI should evaluate (technical_skills, communication, …).
    # Empty list = evaluate all 10 criteria (backward compatible).
    evaluation_criteria: Mapped[list[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(default=0, nullable=False)
    error_message: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    failure_reason: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    failure_stage: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    failure_traceback: Mapped[str] = mapped_column(String(4000), default="", nullable=False)
    processing_progress: Mapped[int] = mapped_column(default=0, nullable=False)  # 0-100
    current_stage: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    # Admin review status — a human-set label the recruiter controls
    # (Processing, Completed, Recommended, Not Recommended,
    # Need Further Review, Rejected, Selected). Independent of the pipeline
    # `status` field so pipeline transitions never clobber it.
    admin_status: Mapped[str] = mapped_column(String(50), default="Processing", nullable=False)
    # Whether the uploaded recording contained audible speech. False means
    # the pipeline completed without transcript/evaluation/PDF — the admin UI
    # shows a "no speech detected" state instead of empty analysis.
    has_speech: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
