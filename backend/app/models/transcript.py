"""Transcript — plain text + timestamped segments + speaker detection."""
import uuid

from sqlalchemy import ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Transcript(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "transcripts"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    full_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # List of {"start": float, "end": float, "text": str, "speaker": str|None}
    segments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    speakers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # detected speakers

    interview: Mapped["Interview"] = relationship(back_populates="transcript")  # noqa: F821
