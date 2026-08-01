"""Interview repository."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from app.models.interview import Interview, InterviewStatus
from app.models.user import User
from app.repositories.base import BaseRepository, _coerce_uuid

# To-one relationships: joinedload folds them into the main query, so a
# full interview loads in ONE round trip instead of N+1.
_TO_ONE = (
    joinedload(Interview.candidate).joinedload(User.profile),
    joinedload(Interview.transcript),
    joinedload(Interview.speech_analysis),
    joinedload(Interview.sentiment_analysis),
    joinedload(Interview.technical_evaluation),
    joinedload(Interview.scores),
    joinedload(Interview.recommendation),
    joinedload(Interview.report),
)


class InterviewRepository(BaseRepository[Interview]):
    model = Interview

    def _with_relations(self, stmt):
        """Load all relations for a full interview."""
        return stmt.options(
            *_TO_ONE,
            selectinload(Interview.files),
            selectinload(Interview.strengths),
            selectinload(Interview.weaknesses),
            selectinload(Interview.pdfs),
        )

    async def get_full(self, id: uuid.UUID | str) -> Interview | None:
        stmt = self._with_relations(select(Interview).where(Interview.id == _coerce_uuid(id)))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_for_analysis(self, id: uuid.UUID | str) -> Interview | None:
        """Load ONLY the relations the analysis bundle needs.

        Skips files/PDF rows (never rendered in the analysis view) so the
        admin detail page loads fast even against a remote database.
        """
        stmt = (
            select(Interview)
            .where(Interview.id == _coerce_uuid(id))
            .options(
                *_TO_ONE,
                selectinload(Interview.strengths),
                selectinload(Interview.weaknesses),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_candidate(self, candidate_id: uuid.UUID | str) -> list[Interview]:
        """List a candidate's interviews for status/lifecycle views.

        Loads only what the candidate-facing status/result flows need:
        pipeline status, timestamps, and the recommendation verdict.
        """
        stmt = (
            select(Interview)
            .where(Interview.candidate_id == _coerce_uuid(candidate_id))
            .order_by(Interview.created_at.desc())
            .options(
                joinedload(Interview.candidate).joinedload(User.profile),
                joinedload(Interview.scores),
                joinedload(Interview.recommendation),
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def latest_for_candidate(self, candidate_id: uuid.UUID | str) -> Interview | None:
        """Fetch the candidate's most recent interview with relations loaded.

        Loads only what the candidate-facing status/result flows need
        (status, timestamps, recommendation verdict, and transcript
        segments for real-duration display) — avoids the heavy transcript
        text / raw payload. Returns None when the candidate has no
        interviews.
        """
        from sqlalchemy.orm import load_only

        from app.models.transcript import Transcript

        stmt = (
            select(Interview)
            .where(Interview.candidate_id == _coerce_uuid(candidate_id))
            .order_by(Interview.created_at.desc())
            .limit(1)
            .options(
                joinedload(Interview.candidate),
                joinedload(Interview.scores),
                joinedload(Interview.recommendation),
                # Only the timestamped segments are needed for real-duration
                # display — skip the giant full_text/raw_response payloads.
                joinedload(Interview.transcript).load_only(
                    Transcript.id,
                    Transcript.interview_id,
                    Transcript.segments,
                ),
            )
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
                joinedload(Interview.candidate).joinedload(User.profile),
                joinedload(Interview.scores),
                joinedload(Interview.recommendation),
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_for_chat(self, limit: int = 100, offset: int = 0) -> list[Interview]:
        """List interviews for the AI assistant (chat tool).

        Includes what ``_serialize_interview`` renders (scores, strengths,
        weaknesses, recommendation, technical evaluation) but deliberately
        SKIPS the giant transcript text / raw Deepgram JSON and the report's
        eleven text columns — those are only needed by the detail views.
        """
        stmt = (
            select(Interview)
            .order_by(Interview.created_at.desc())
            .limit(limit)
            .offset(offset)
            .options(
                joinedload(Interview.candidate).joinedload(User.profile),
                joinedload(Interview.scores),
                joinedload(Interview.technical_evaluation),
                joinedload(Interview.recommendation),
                selectinload(Interview.strengths),
                selectinload(Interview.weaknesses),
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_for_chat_by_candidate(
        self, candidate_id: uuid.UUID | str, limit: int = 100
    ) -> list[Interview]:
        """Like ``list_for_chat`` but scoped to one candidate's interviews."""
        stmt = (
            select(Interview)
            .where(Interview.candidate_id == _coerce_uuid(candidate_id))
            .order_by(Interview.created_at.desc())
            .limit(limit)
            .options(
                joinedload(Interview.candidate).joinedload(User.profile),
                joinedload(Interview.scores),
                joinedload(Interview.technical_evaluation),
                joinedload(Interview.recommendation),
                selectinload(Interview.strengths),
                selectinload(Interview.weaknesses),
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
