"""Interview repository."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.interview import Interview, InterviewStatus
from app.models.user import User
from app.repositories.base import BaseRepository, _coerce_uuid


class InterviewRepository(BaseRepository[Interview]):
    model = Interview

    def _with_relations(self, stmt):
        return stmt.options(
            selectinload(Interview.candidate).selectinload(User.profile),
            selectinload(Interview.files),
            selectinload(Interview.transcript),
            selectinload(Interview.speech_analysis),
            selectinload(Interview.sentiment_analysis),
            selectinload(Interview.technical_evaluation),
            selectinload(Interview.scores),
            selectinload(Interview.strengths),
            selectinload(Interview.weaknesses),
            selectinload(Interview.recommendation),
            selectinload(Interview.report),
            selectinload(Interview.pdfs),
        )

    async def get_full(self, id: uuid.UUID | str) -> Interview | None:
        stmt = self._with_relations(select(Interview).where(Interview.id == _coerce_uuid(id)))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_candidate(self, candidate_id: uuid.UUID | str) -> list[Interview]:
        stmt = (
            select(Interview)
            .where(Interview.candidate_id == _coerce_uuid(candidate_id))
            .order_by(Interview.created_at.desc())
            .options(
                selectinload(Interview.candidate).selectinload(User.profile),
                selectinload(Interview.files),
                selectinload(Interview.transcript),
                selectinload(Interview.speech_analysis),
                selectinload(Interview.sentiment_analysis),
                selectinload(Interview.technical_evaluation),
                selectinload(Interview.scores),
                selectinload(Interview.strengths),
                selectinload(Interview.weaknesses),
                selectinload(Interview.recommendation),
                selectinload(Interview.report),
                selectinload(Interview.pdfs),
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def latest_for_candidate(self, candidate_id: uuid.UUID | str) -> Interview | None:
        """Fetch the candidate's most recent interview with relations loaded.

        Avoids the list-then-refetch pattern (two queries, one of which
        loads every historical interview). Returns None when the candidate
        has no interviews.
        """
        stmt = (
            self._with_relations(
                select(Interview)
                .where(Interview.candidate_id == _coerce_uuid(candidate_id))
                .order_by(Interview.created_at.desc())
            )
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_all_full(self) -> list[Interview]:
        """List all interviews with relations eagerly loaded.

        Required for handlers that read relationship attributes (scores,
        recommendation) — lazy loads crash in async sessions.
        """
        stmt = self._with_relations(
            select(Interview).order_by(Interview.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_all_summary(self) -> list[Interview]:
        """List all interviews with only the relations the admin list needs.

        Lighter than ``list_all_full`` — skips the heavy transcript /
        technical evaluation / report payloads that the list view never
        renders, avoiding the large SELECTs those columns produce.
        """
        stmt = (
            select(Interview)
            .order_by(Interview.created_at.desc())
            .options(
                selectinload(Interview.candidate).selectinload(User.profile),
                selectinload(Interview.scores),
                selectinload(Interview.recommendation),
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_for_pdf(self, id: uuid.UUID | str) -> Interview | None:
        """Load ONLY the relations the PDF renderer needs.

        Skips the transcript's raw Deepgram response, speech/sentiment
        analysis, technical evaluation and file rows — none are used by the
        PDF. This keeps on-demand PDF generation (Issue 8) fast even for
        large recordings.
        """
        stmt = (
            select(Interview)
            .where(Interview.id == _coerce_uuid(id))
            .options(
                selectinload(Interview.candidate),
                selectinload(Interview.scores),
                selectinload(Interview.strengths),
                selectinload(Interview.weaknesses),
                selectinload(Interview.recommendation),
                selectinload(Interview.report),
                selectinload(Interview.transcript),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def set_status(self, id: uuid.UUID | str, status: InterviewStatus, error: str = "") -> None:
        values = {"status": status}
        if error:
            values["error_message"] = error
        elif status != InterviewStatus.FAILED:
            values["error_message"] = ""
        if status == InterviewStatus.PROCESSING:
            values["started_at"] = datetime.now(timezone.utc)
            values["processing_progress"] = 0
            values["current_stage"] = "processing"
            # Clear stale failure diagnostics from a previous attempt.
            values["failure_reason"] = ""
            values["failure_stage"] = ""
            values["failure_traceback"] = ""
        if status == InterviewStatus.COMPLETED:
            values["completed_at"] = datetime.now(timezone.utc)
            values["processing_finished_at"] = datetime.now(timezone.utc)
            values["processing_progress"] = 100
            values["current_stage"] = "completed"
            values["failure_reason"] = ""
            values["failure_stage"] = ""
            values["failure_traceback"] = ""
        await self.update(id, **values)

    async def mark_failed(
        self,
        id: uuid.UUID | str,
        *,
        reason: str,
        stage: str = "",
        traceback_text: str = "",
    ) -> None:
        """Mark an interview as failed with full diagnostic detail.

        This is the guaranteed terminal state for any processing error —
        an interview can never be left stuck in 'processing'.
        """
        now = datetime.now(timezone.utc)
        values = {
            "status": InterviewStatus.FAILED,
            "error_message": reason[:1000],
            "failure_reason": reason[:1000],
            "failure_stage": stage[:100],
            "failure_traceback": traceback_text[:4000],
            "processing_finished_at": now,
            "completed_at": now,
            "current_stage": stage[:100] or "failed",
        }
        await self.update(id, **values)

    async def create(
        self,
        candidate_id: uuid.UUID,
        job_title: str = "",
        job_description: str = "",
    ) -> Interview:
        interview = Interview(
            candidate_id=candidate_id,
            job_title=job_title,
            job_description=job_description,
            status=InterviewStatus.UPLOADED,
        )
        return await self.add(interview)
