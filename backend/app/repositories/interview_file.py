"""Repositories for interview files and jobs.

ActivityLogRepository moved to app.repositories.activity_log — it is
re-exported here for backwards compatibility with existing imports.
"""
import uuid

from sqlalchemy import select

from app.models.interview_file import InterviewFile
from app.models.job import Job
from app.repositories.activity_log import ActivityLogRepository  # noqa: F401 (re-export)
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
