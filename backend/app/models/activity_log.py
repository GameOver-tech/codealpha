"""Activity log — audit trail of admin/candidate actions."""
import uuid

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class ActivityLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "activity_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Optional link to the chat conversation that triggered the action.
    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
