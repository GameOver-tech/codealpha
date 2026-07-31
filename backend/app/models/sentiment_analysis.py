"""Sentiment analysis — tone/emotion/professionalism of the interview."""
import uuid

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class SentimentAnalysis(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sentiment_analysis"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    sentiment: Mapped[str] = mapped_column(String(30), default="", nullable=False)  # positive|neutral|negative
    emotion: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-100
    professionalism: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-100
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="sentiment_analysis")  # noqa: F821
