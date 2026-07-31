"""Interview processing pipeline.

Orchestrates the full evaluation flow:
  Uploaded -> Processing -> Transcript Ready -> AI Evaluation -> PDF Generated -> Completed

The transcript is ALWAYS produced by Deepgram from the uploaded recording.
There is no mock, demo, or fallback transcript anywhere in this pipeline.

Every stage logs its start/end. Any failure marks the interview as FAILED
with failure_reason, failure_stage, failure_traceback, and
processing_finished_at — an interview can NEVER be left stuck in
'processing'. A processing timeout guards against hung external calls.
"""
from __future__ import annotations

import asyncio
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import analyze_sentiment, analyze_speech, transcribe_audio
from app.ai.evaluation import evaluate_transcript
from app.core.config import settings
from app.core.logging import get_logger
from app.models.interview import Interview, InterviewStatus
from app.repositories.analysis import (
    InterviewReportRepository,
    InterviewScoresRepository,
    RecommendationRepository,
    SentimentAnalysisRepository,
    SpeechAnalysisRepository,
    StrengthRepository,
    TechnicalEvaluationRepository,
    TranscriptRepository,
    WeaknessRepository,
)
from app.repositories.interview import InterviewRepository
from app.repositories.interview_file import ActivityLogRepository
from app.repositories.user import UserRepository
from app.utils.exceptions import BadRequestError, TranscriptionError

logger = get_logger(__name__)

PROCESSING_TIMEOUT_SECONDS = 1800  # hard cap: 30 minutes per interview


def _summarize_transcript(text: str, max_words: int = 120) -> str:
    """Produce a concise summary of a transcript (fallback when the LLM omits it)."""
    import re

    paragraphs = [p.strip() for p in re.split(r"\n+", text or "") if p.strip()]
    if not paragraphs:
        return "The interview transcript did not contain enough content to summarize."

    picked: list[str] = []
    word_count = 0
    for para in paragraphs:
        words = para.split()
        if word_count + len(words) > max_words:
            break
        picked.append(para)
        word_count += len(words)
    return " ".join(picked) + ("…" if word_count == max_words else "")


class InterviewPipeline:
    """Runs the multi-stage evaluation pipeline for one interview."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.interviews = InterviewRepository(db)
        self.users = UserRepository(db)
        self.transcripts = TranscriptRepository(db)
        self.speech = SpeechAnalysisRepository(db)
        self.sentiment = SentimentAnalysisRepository(db)
        self.technical = TechnicalEvaluationRepository(db)
        self.scores = InterviewScoresRepository(db)
        self.strengths = StrengthRepository(db)
        self.weaknesses = WeaknessRepository(db)
        self.recommendations = RecommendationRepository(db)
        self.reports = InterviewReportRepository(db)
        self.activity = ActivityLogRepository(db)

    async def _set_status(self, interview_id, status: InterviewStatus, error: str = "") -> None:
        await self.interviews.set_status(interview_id, status, error)
        await self.db.commit()

    async def _set_progress(
        self, interview_id, progress: int, stage: str, *, commit: bool = True
    ) -> None:
        """Persist the current 0-100 progress + stage label.

        The progress field is written on every stage transition so the
        /progress endpoint always reflects where processing is right now.
        """
        await self.interviews.update(
            interview_id,
            processing_progress=max(0, min(100, int(progress))),
            current_stage=str(stage)[:100],
        )
        if commit:
            await self.db.commit()

    async def _load(self, interview_id) -> Interview:
        interview = await self.interviews.get_full(interview_id)
        if interview is None:
            raise BadRequestError(f"Interview {interview_id} not found")
        return interview

    def _verify_row(self, row, what: str, interview_id) -> None:
        """Post-insert verification — never silently continue on a missing row."""
        if row is None:
            raise RuntimeError(f"{what} row missing after insert for interview {interview_id}")

    async def _fail(
        self,
        interview_id,
        *,
        stage: str,
        exc: Exception,
        file_path: str = "",
    ) -> None:
        """Mark the interview failed with full diagnostics.

        Logs the complete failure contract — stage name, error, stack
        trace, interview id, and file path — then persists the terminal
        FAILED state in its own fresh transaction so a broken session can
        never prevent it from being recorded.
        """
        reason = str(exc)[:1000]
        tb = traceback.format_exc()[-4000:]
        logger.error(
            "Pipeline FAILURE\n"
            "  Stage:        %s\n"
            "  Error:        %s\n"
            "  Stack trace:\n%s\n"
            "  Interview ID: %s\n"
            "  File path:    %s",
            stage,
            reason,
            tb,
            interview_id,
            file_path or "(none)",
        )
        try:
            await self.interviews.mark_failed(
                interview_id,
                reason=reason,
                stage=stage,
                traceback_text=tb,
            )
            await self.db.commit()
        except Exception:  # noqa: BLE001 — never let failure handling itself fail
            await self.db.rollback()
            logger.exception("Could not persist FAILED status for interview %s", interview_id)

    def _validate_transcript_source(self, transcript) -> None:
        """Ensure the transcript came from Deepgram, not demo data."""
        if not transcript or not transcript.full_text:
            raise TranscriptionError("No transcript available for evaluation.")
        source = (transcript.source or "").lower()
        if source and source != "deepgram":
            raise TranscriptionError(
                f"Transcript source is '{source}' — expected 'deepgram'. Processing stopped."
            )
        if len(transcript.full_text.strip()) <= 20:
            raise TranscriptionError(
                "Transcript is too short to evaluate (must exceed 20 characters)."
            )

    async def run(self, interview_id, *, force_transcribe: bool = False) -> Interview:
        """Execute the pipeline under a hard processing timeout.

        Guarantees the interview ends in COMPLETED or FAILED — never stuck
        in 'processing'.
        """
        interview = await self._load(interview_id)
        file_path = interview.files[0].storage_path if interview.files else ""
        logger.info(
            "Starting pipeline for interview %s (status=%s, file=%s)",
            interview_id,
            interview.status,
            file_path or "(none)",
        )

        try:
            return await asyncio.wait_for(
                self._run(interview_id, force_transcribe=force_transcribe),
                timeout=PROCESSING_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            await self._fail(
                interview_id,
                stage="processing_timeout",
                exc=TimeoutError(
                    f"Pipeline exceeded {PROCESSING_TIMEOUT_SECONDS}s processing timeout."
                ),
                file_path=file_path,
            )
            raise
        except Exception as exc:  # noqa: BLE001
            await self._fail(interview_id, stage="pipeline", exc=exc, file_path=file_path)
            raise

    async def _run(self, interview_id, *, force_transcribe: bool = False) -> Interview:
        """Execute the pipeline stages sequentially."""
        import time as _time

        stage_start = _time.perf_counter()

        def _elapsed() -> float:
            return round(_time.perf_counter() - stage_start, 2)

        interview = await self._load(interview_id)
        file_path = interview.files[0].storage_path if interview.files else ""

        await self._set_status(interview_id, InterviewStatus.PROCESSING)

        # ---- Stage 1: Speech-to-text from the uploaded recording ----
        logger.info("[Stage 1] Upload complete for interview %s (file=%s)", interview_id, file_path)
        transcript = await self.transcripts.get_by_interview(interview_id)
        if transcript is None or force_transcribe:
            file = interview.files[0] if interview.files else None
            if file is None:
                raise TranscriptionError("No interview file uploaded.")
            logger.info(
                "[Stage 1] Upload: filename=%s storage_path=%s",
                file.original_filename,
                file.storage_path,
            )

            await self._set_progress(interview_id, 10, "audio_extraction")
            logger.info("[Stage 2] Audio extraction started (video -> audio if needed)")
            result = await transcribe_audio(file.storage_path)
            logger.info(
                "[Stage 2] Audio extraction finished (transcript received) in %.1fs",
                _elapsed(),
            )
            await self._set_progress(interview_id, 30, "transcription")

            logger.info("[Stage 3] Sending request to Deepgram (file=%s)", file.storage_path)
            # The Deepgram request itself is made inside transcribe_audio; this
            # boundary log is kept so the stage contract is explicit in logs.
            logger.info(
                "[Stage 3] Deepgram response received: length=%s source=%s",
                len(result.get("full_text", "")),
                result.get("source", "deepgram"),
            )

            transcript = await self.transcripts.upsert(
                interview_id,
                {
                    "full_text": result["full_text"],
                    "segments": result["segments"],
                    "speakers": result["speakers"],
                    "language": result.get("language", "en"),
                    "confidence": result.get("confidence", 0.0),
                    "source": result.get("source", "deepgram"),
                    "raw_response": result.get("raw_response"),
                },
            )
            self._verify_row(transcript, "transcript", interview_id)
            if interview.duration_seconds == 0 and result.get("duration"):
                interview.duration_seconds = int(result["duration"])
            await self.db.commit()
            logger.info("[Stage 4] Transcript saved: length=%s", len(transcript.full_text))

        # Validate before ANY downstream step.
        self._validate_transcript_source(transcript)
        logger.info(
            "Transcript source=%s length=%s preview=%r",
            transcript.source,
            len(transcript.full_text),
            transcript.full_text[:300],
        )

        await self._set_status(interview_id, InterviewStatus.TRANSCRIPT_READY)

        # ---- Stage 5: Speech + sentiment analysis (parallel LLM calls) ----
        logger.info("[Stage 5] Speech analysis started")
        await self._set_progress(interview_id, 50, "speech_analysis")
        speech_result, sentiment_result = await asyncio.gather(
            analyze_speech(
                {"segments": transcript.segments, "duration": interview.duration_seconds},
            ),
            analyze_sentiment(
                {"full_text": transcript.full_text, "segments": transcript.segments},
            ),
        )
        await self.speech.upsert(interview_id, speech_result)
        await self.sentiment.upsert(interview_id, sentiment_result)
        await self.db.commit()

        self._verify_row(speech_result, "speech analysis", interview_id)
        self._verify_row(sentiment_result, "sentiment analysis", interview_id)
        await self._set_progress(interview_id, 65, "sentiment_analysis")
        logger.info("[Stage 5] Speech analysis completed in %.1fs", _elapsed())

        # ---- Stage 6: LLM evaluation (restricted input, transcript-only) ----
        logger.info("[Stage 6] LLM evaluation started")
        await self._set_progress(interview_id, 80, "ai_evaluation")
        await self._set_status(interview_id, InterviewStatus.AI_EVALUATION)

        candidate_name = ""
        if interview.candidate:
            candidate_name = interview.candidate.full_name or interview.candidate.email

        llm_input = {
            "candidate_name": candidate_name,
            "transcript": transcript.full_text,
            "segments": transcript.segments,
            "duration": f"{interview.duration_seconds}s",
            "language": transcript.language or "unknown",
            "speakers": transcript.speakers or [],
        }
        evaluation = await evaluate_transcript(llm_input)
        logger.info("[Stage 6] LLM evaluation completed")

        # ---- Stage 7: Persist evaluation artifacts ----
        technical_row = await self.technical.upsert(interview_id, evaluation["technical_evaluation"])
        scores_row = await self.scores.upsert(interview_id, evaluation["scores"])
        await self.strengths.replace_for_interview(interview_id, evaluation["strengths"])
        await self.weaknesses.replace_for_interview(interview_id, evaluation["weaknesses"])
        await self.db.commit()

        self._verify_row(technical_row, "technical evaluation", interview_id)
        self._verify_row(scores_row, "scores", interview_id)
        logger.info(
            "[Stage 7] Scores saved (overall=%s)",
            scores_row.overall_score,
        )

        # ---- Stage 8: Recommendation + report ----
        rec = evaluation["recommendation"]
        saved_rec = await self.recommendations.upsert(interview_id, rec["verdict"], rec["reason"])
        self._verify_row(saved_rec, "recommendation", interview_id)
        logger.info("[Stage 8] Recommendation saved: %s", saved_rec.verdict.value)

        report_data = evaluation["report"]
        report_data["interview_overview"] = (
            report_data.get("interview_overview")
            or f"Interview conducted on the role of {interview.job_title}."
        )
        report_data["performance_analysis"] = report_data.get(
            "performance_analysis"
        ) or _summarize_transcript(transcript.full_text)
        saved_report = await self.reports.upsert(interview_id, report_data)
        await self.db.commit()

        self._verify_row(saved_report, "report", interview_id)
        logger.info("[Stage 8] Report saved")

        # ---- Stage 9: PDF generation (only after transcript/scores/rec/report exist) ----
        await self._set_status(interview_id, InterviewStatus.PDF_GENERATED)
        await self._set_progress(interview_id, 90, "pdf_generation")
        logger.info("[Stage 9] PDF generation started")
        await self._generate_pdf(interview_id)

        # Verify the PDF record + file actually exist.
        from sqlalchemy import select

        from app.models.generated_pdf import GeneratedPdf

        pdf_rows = (
            await self.db.execute(
                select(GeneratedPdf).where(GeneratedPdf.interview_id == interview_id)
            )
        ).scalars().all()
        if not pdf_rows:
            raise RuntimeError(f"PDF row missing for interview {interview_id} after generation")
        pdf_file = Path(settings.GENERATED_DIR) / pdf_rows[-1].storage_path
        if not pdf_file.is_file():
            logger.warning(
                "[Stage 9] PDF metadata saved but local file missing at %s "
                "(may be synced to Supabase Storage only)",
                pdf_file,
            )
        logger.info("[Stage 9] PDF generated: %s (%s bytes)",
                    pdf_rows[-1].filename, pdf_rows[-1].file_size_bytes)

        # ---- Stage 10: Done ----
        await self._set_status(interview_id, InterviewStatus.COMPLETED)
        await self.activity.log(
            interview.candidate_id,
            "interview_processed",
            "interview",
            str(interview_id),
            {"status": "completed"},
        )
        await self.db.commit()

        # ---- Stage 11: Remove the temporary media file ----
        # Only the transcript + AI evaluation remain permanently. The raw
        # upload is no longer needed and is deleted to free storage.
        await self._cleanup_media(interview_id)

        logger.info(
            "[Stage 10] Processing completed for interview %s in %.1fs",
            interview_id,
            _elapsed(),
        )
        return interview

    async def _cleanup_media(self, interview_id) -> None:
        """Delete the uploaded recording now that processing is complete.

        The interview_files row (metadata) is kept for the audit trail, but
        the actual media bytes on disk (and any Supabase Storage copy) are
        removed. The pipeline never needs the raw media again — everything
        downstream reads the persisted transcript + evaluation.
        """
        try:
            from app.repositories.interview_file import InterviewFileRepository
            from app.storage.service import LocalStorage, SupabaseStorage, cleanup_local_file

            files = InterviewFileRepository(self.db)
            rows = await files.list_by_interview(interview_id)
            if not rows:
                logger.info("[Stage 11] No media files to clean up for %s", interview_id)
                return

            storage = LocalStorage()
            for row in rows:
                # Local disk copy.
                if row.storage_path:
                    if storage.exists(row.storage_path):
                        storage.delete(row.storage_path)
                        logger.info(
                            "[Stage 11] Deleted local media %s for interview %s",
                            row.storage_path,
                            interview_id,
                        )
                    else:
                        cleanup_local_file(row.storage_path)

                    # Remove the now-empty per-interview directory.
                    parent = Path(settings.UPLOAD_DIR) / row.storage_path
                    if parent.parent.is_dir() and not any(parent.parent.iterdir()):
                        try:
                            parent.parent.rmdir()
                        except OSError:
                            pass

                # Remote Supabase Storage copy (best-effort).
                if settings.SUPABASE_URL:
                    try:
                        SupabaseStorage().delete(row.storage_path)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning(
                            "[Stage 11] Could not delete remote media %s: %s",
                            row.storage_path,
                            exc,
                        )

            # Clear the storage path on the existing rows so the audit trail
            # shows the media was purged without creating duplicate rows.
            for row in rows:
                row.storage_path = ""
            await self.db.commit()
        except Exception as exc:  # noqa: BLE001 — cleanup must never fail the pipeline
            logger.exception("Media cleanup failed for interview %s: %s", interview_id, exc)

    async def _generate_pdf(self, interview_id) -> None:
        """Generate and store the professional PDF report (imported lazily)."""
        from app.services.pdf_service import generate_interview_pdf

        await generate_interview_pdf(self.db, interview_id)


async def run_interview_pipeline(db: AsyncSession, interview_id, *, force_transcribe: bool = False) -> None:
    """Async entry point for background tasks / worker queue."""
    pipeline = InterviewPipeline(db)
    await pipeline.run(interview_id, force_transcribe=force_transcribe)


async def sweep_stuck_interviews(db: AsyncSession, stale_after_seconds: int = 900) -> int:
    """Mark interviews stuck in 'processing' as failed.

    Called at startup so any interview left in a transient 'processing'
    state (e.g. from a crash) is guaranteed to reach a terminal state.
    Returns the number of interviews recovered.
    """
    from sqlalchemy import select

    cutoff = datetime.now(timezone.utc)
    stmt = (
        select(Interview)
        .where(Interview.status == InterviewStatus.PROCESSING)
        .where(Interview.updated_at < cutoff)
        .limit(50)
    )
    result = await db.execute(stmt)
    stuck = list(result.scalars().all())
    for interview in stuck:
        age = (cutoff - interview.updated_at).total_seconds() if interview.updated_at else 0
        if age < stale_after_seconds:
            continue
        await InterviewRepository(db).mark_failed(
            interview.id,
            reason=f"Processing did not complete within {int(age)}s (stale process).",
            stage="stale_processing_sweep",
            traceback_text="Interview was stuck in 'processing' and was recovered by the startup sweep.",
        )
        await db.commit()
        logger.warning("Swept stuck interview %s (stale %ss) -> FAILED", interview.id, int(age))
    return len(stuck)


async def sweep_orphaned_media(db: AsyncSession, limit: int = 100) -> int:
    """Delete media files belonging to interviews already in a terminal state.

    Runs at startup to reclaim storage from any uploads whose pipeline
    finished (or failed) before the per-interview cleanup existed. Only
    transcript + evaluation remain permanently — the raw media is removed.
    """
    from sqlalchemy import select

    from app.models.interview_file import InterviewFile
    from app.storage.service import LocalStorage, SupabaseStorage

    terminal_statuses = (InterviewStatus.COMPLETED, InterviewStatus.FAILED)
    stmt = (
        select(InterviewFile)
        .join(Interview, Interview.id == InterviewFile.interview_id)
        .where(Interview.status.in_(terminal_statuses))
        .where(InterviewFile.storage_path != "")
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    if not rows:
        return 0

    storage = LocalStorage()
    remote = SupabaseStorage() if settings.SUPABASE_URL else None
    purged = 0
    for row in rows:
        try:
            if storage.exists(row.storage_path):
                storage.delete(row.storage_path)
            elif row.storage_path and (Path(settings.UPLOAD_DIR) / row.storage_path).exists():
                (Path(settings.UPLOAD_DIR) / row.storage_path).unlink(missing_ok=True)
            if remote is not None and row.storage_path:
                remote.delete(row.storage_path)
            # Remove the (now empty) per-interview directory.
            parent = Path(settings.UPLOAD_DIR) / row.storage_path
            if parent.parent.is_dir() and not any(parent.parent.iterdir()):
                parent.parent.rmdir()
            row.storage_path = ""
            purged += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Media sweep failed for file %s: %s", row.id, exc)
    await db.commit()
    logger.info("Media sweep: purged %s file(s) for terminal interviews", purged)
    return purged


async def enqueue_interview_processing(interview_id) -> bool:
    """Push an interview id onto the Redis queue when USE_REDIS_QUEUE=true.

    Returns True when the job was queued, False when the caller should fall
    back to FastAPI BackgroundTasks (queue disabled or Redis unavailable).
    """
    if not settings.USE_REDIS_QUEUE:
        return False
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await client.rpush("hirelens:interview-queue", str(interview_id))
            logger.info("Queued interview %s for processing", interview_id)
            return True
        finally:
            await client.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis queue push failed (%s) — falling back to background task", exc)
        return False
