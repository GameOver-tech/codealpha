"""Candidate profile — extends user with candidate-specific fields."""
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class CandidateProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "candidate_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    experience: Mapped[str] = mapped_column(Text, default="", nullable=False)
    skills: Mapped[str] = mapped_column(Text, default="", nullable=False)  # comma-separated
    education: Mapped[str] = mapped_column(Text, default="", nullable=False)
    current_company: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    expected_salary: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    profile_picture_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    resume_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    user: Mapped["User"] = relationship(back_populates="profile")  # noqa: F821
