"""Transcript — Deepgram transcription output for an interview.

Stores the full text, timestamped segments, detected speakers, language,
overall confidence, and the complete raw Deepgram response so nothing is
lost and the source of the transcript is always verifiable.
"""
import uuid

from sqlalchemy import Float, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Transcript(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "transcripts"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    full_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # List of {"start": float, "end": float, "text": str, "speaker": str|None, "confidence": float}
    segments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    speakers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # detected speakers
    language: Mapped[str] = mapped_column(String(20), default="en", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Source of the transcript — always "deepgram" in production.
    source: Mapped[str] = mapped_column(String(30), default="deepgram", nullable=False)
    # Complete raw Deepgram response payload.
    raw_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    interview: Mapped["Interview"] = relationship(back_populates="transcript")  # noqa: F821
