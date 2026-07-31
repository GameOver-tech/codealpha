"""Speech analysis — prosody metrics derived from the audio."""
import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class SpeechAnalysis(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "speech_analysis"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    speech_speed_wpm: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    avg_pause_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_pauses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    speaking_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # words/sec
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-100
    tone: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    emotion: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    clarity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-100
    fluency: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-100
    energy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-100
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="speech_analysis")  # noqa: F821
