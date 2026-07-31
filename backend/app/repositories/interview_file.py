"""Repositories for interview files, jobs + activity logs (small entities)."""
import uuid

from sqlalchemy import select

from app.models.activity_log import ActivityLog
from app.models.interview_file import InterviewFile
from app.models.job import Job
from app.repositories.base import BaseRepository, _coerce_uuid


class InterviewFileRepository(BaseRepository[InterviewFile]):
    model = InterviewFile

    async def create(
        self,
        interview_id: uuid.UUID,
        original_filename: str,
        storage_path: str,
        content_type: str = "",
        file_size_bytes: int = 0,
        duration_seconds: int = 0,
        is_primary: bool = True,
    ) -> InterviewFile:
        return await self.add(
            InterviewFile(
                interview_id=interview_id,
                original_filename=original_filename,
                storage_path=storage_path,
                content_type=content_type,
                file_size_bytes=file_size_bytes,
                duration_seconds=duration_seconds,
                is_primary=is_primary,
            )
        )

    async def list_by_interview(self, interview_id: uuid.UUID) -> list[InterviewFile]:
        stmt = (
            select(InterviewFile)
            .where(InterviewFile.interview_id == _coerce_uuid(interview_id))
            .order_by(InterviewFile.created_at)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class JobRepository(BaseRepository[Job]):
    model = Job

    async def list_active(self) -> list[Job]:
        stmt = select(Job).where(Job.is_active.is_(True)).order_by(Job.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


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
