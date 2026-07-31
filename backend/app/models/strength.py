"""Strength and weakness models — bullet items per interview."""
import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Strength(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "strengths"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="strengths")  # noqa: F821


class Weakness(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "weaknesses"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="weaknesses")  # noqa: F821
