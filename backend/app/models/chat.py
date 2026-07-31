"""Chat persistence — conversations and messages for the AI assistant."""
import uuid

from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ChatConversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "chat_conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), default="New Chat", nullable=False)

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class ChatMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "chat_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | tool
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tool_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tool_args: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Internal only — never serialized back to the client.
    tool_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    conversation: Mapped[ChatConversation] = relationship(back_populates="messages")
