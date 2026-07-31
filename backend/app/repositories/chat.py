"""Repositories for chat conversations and messages."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.chat import ChatConversation, ChatMessage
from app.repositories.base import BaseRepository, _coerce_uuid


class ChatConversationRepository(BaseRepository[ChatConversation]):
    model = ChatConversation

    async def create(self, user_id: uuid.UUID, title: str) -> ChatConversation:
        return await self.add(ChatConversation(user_id=user_id, title=title))

    async def list_by_user(self, user_id: uuid.UUID) -> list[ChatConversation]:
        stmt = (
            select(ChatConversation)
            .where(ChatConversation.user_id == _coerce_uuid(user_id))
            .order_by(ChatConversation.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_with_messages(self, conversation_id: uuid.UUID | str) -> ChatConversation | None:
        stmt = (
            select(ChatConversation)
            .where(ChatConversation.id == _coerce_uuid(conversation_id))
            .options(selectinload(ChatConversation.messages))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()


class ChatMessageRepository(BaseRepository[ChatMessage]):
    model = ChatMessage

    async def add_user_message(
        self, conversation_id: uuid.UUID, content: str
    ) -> ChatMessage:
        return await self.add(
            ChatMessage(conversation_id=conversation_id, role="user", content=content)
        )

    async def add_assistant_message(
        self, conversation_id: uuid.UUID, content: str
    ) -> ChatMessage:
        return await self.add(
            ChatMessage(conversation_id=conversation_id, role="assistant", content=content)
        )

    async def add_tool_message(
        self,
        conversation_id: uuid.UUID,
        tool_name: str,
        tool_args: dict | None,
        tool_result: dict | None,
        error: str | None = None,
    ) -> ChatMessage:
        return await self.add(
            ChatMessage(
                conversation_id=conversation_id,
                role="tool",
                content="",
                tool_name=tool_name,
                tool_args=tool_args,
                tool_result=tool_result,
                error=error,
            )
        )

    async def list_by_conversation(
        self, conversation_id: uuid.UUID | str
    ) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.conversation_id == _coerce_uuid(conversation_id))
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
