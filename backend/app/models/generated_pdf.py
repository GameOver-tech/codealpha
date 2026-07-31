"""Generated PDF — stored file metadata for each generated report PDF."""
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class GeneratedPdf(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "generated_pdfs"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(default=0, nullable=False)

    interview: Mapped["Interview"] = relationship(back_populates="pdfs")  # noqa: F821
