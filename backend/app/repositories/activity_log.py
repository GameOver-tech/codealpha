"""Activity log repository — audit trail of admin/candidate actions."""
import uuid

from sqlalchemy import select

from app.models.activity_log import ActivityLog
from app.repositories.base import BaseRepository, _coerce_uuid


class ActivityLogRepository(BaseRepository[ActivityLog]):
    model = ActivityLog

    async def log(
        self,
        user_id: uuid.UUID | None,
        action: str,
        entity_type: str = "",
        entity_id: str = "",
        details: dict | None = None,
    ) -> ActivityLog:
        return await self.add(
            ActivityLog(
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details or {},
            )
        )

    async def list_recent(self, limit: int = 50) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
