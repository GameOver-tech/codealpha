"""Interview processing pipeline.

Orchestrates the full evaluation flow:
  Uploaded -> Processing -> Transcript Ready -> AI Evaluation -> PDF Generated -> Completed

The transcript is ALWAYS produced by Deepgram from the uploaded recording.
There is no mock, demo, or fallback transcript anywhere in this pipeline.
If transcription fails, processing stops and the interview is marked failed.

The pipeline is resumable: if a transcript already exists (admin "regenerate"
flow), it skips speech-to-text and re-runs evaluation from that transcript.
"""
from __future__ import annotations

import traceback
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


def _summarize_transcript(text: str, max_words: int = 120) -> str:
    """Produce a concise summary of a transcript (fallback when the LLM omits it).

    Takes the opening interviewer question and the first candidate response,
    which usually captures the role and the candidate's background.
    """
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

    async def _load(self, interview_id) -> Interview:
        interview = await self.interviews.get_full(interview_id)
        if interview is None:
            raise BadRequestError(f"Interview {interview_id} not found")
        return interview

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
        """Execute the pipeline. Idempotent-ish: safe to re-run for regeneration."""
        interview = await self._load(interview_id)
        logger.info("Starting pipeline for interview %s (status=%s)", interview_id, interview.status)

        await self._set_status(interview_id, InterviewStatus.PROCESSING)

        try:
            # ---- Stage 1: Speech-to-text from the uploaded recording ----
            transcript = await self.transcripts.get_by_interview(interview_id)
            if transcript is None or force_transcribe:
                await self._set_status(interview_id, InterviewStatus.PROCESSING)
                file = interview.files[0] if interview.files else None
                if file is None:
                    raise TranscriptionError("No interview file uploaded.")
                logger.info(
                    "Processing upload: filename=%s storage_path=%s",
                    file.original_filename,
                    file.storage_path,
                )
                result = await transcribe_audio(file.storage_path)
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
                if interview.duration_seconds == 0 and result.get("duration"):
                    interview.duration_seconds = int(result["duration"])
                await self.db.commit()

            # Validate before ANY downstream step.
            self._validate_transcript_source(transcript)
            logger.info(
                "Transcript source=%s length=%s preview=%r",
                transcript.source,
                len(transcript.full_text),
                transcript.full_text[:300],
            )

            await self._set_status(interview_id, InterviewStatus.TRANSCRIPT_READY)

            # ---- Stage 2: Speech + sentiment analysis (derived from segments) ----
            speech = await analyze_speech(
                {"segments": transcript.segments, "duration": interview.duration_seconds},
            )
            sentiment = await analyze_sentiment(
                {"full_text": transcript.full_text, "segments": transcript.segments},
            )
            await self.speech.upsert(interview_id, speech)
            await self.sentiment.upsert(interview_id, sentiment)
            await self.db.commit()

            # ---- Stage 3: LLM evaluation (restricted input, transcript-only) ----
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
            logger.info("LLM input preview: %s", str(llm_input)[:300])
            evaluation = await evaluate_transcript(llm_input)

            # ---- Stage 4: Persist evaluation artifacts ----
            await self.technical.upsert(interview_id, evaluation["technical_evaluation"])
            await self.scores.upsert(interview_id, evaluation["scores"])
            await self.strengths.replace_for_interview(interview_id, evaluation["strengths"])
            await self.weaknesses.replace_for_interview(interview_id, evaluation["weaknesses"])

            rec = evaluation["recommendation"]
            await self.recommendations.upsert(interview_id, rec["verdict"], rec["reason"])

            report_data = evaluation["report"]
            report_data["interview_overview"] = (
                report_data.get("interview_overview")
                or f"Interview conducted on the role of {interview.job_title}."
            )
            report_data["performance_analysis"] = report_data.get(
                "performance_analysis"
            ) or _summarize_transcript(transcript.full_text)
            await self.reports.upsert(interview_id, report_data)
            await self.db.commit()

            # ---- Stage 5: PDF generation ----
            await self._set_status(interview_id, InterviewStatus.PDF_GENERATED)
            await self._generate_pdf(interview_id)

            # ---- Done ----
            await self._set_status(interview_id, InterviewStatus.COMPLETED)
            await self.activity.log(
                interview.candidate_id,
                "interview_processed",
                "interview",
                str(interview_id),
                {"status": "completed"},
            )
            await self.db.commit()
            logger.info("Pipeline completed for interview %s", interview_id)
            return interview
        except Exception as exc:  # noqa: BLE001
            await self.db.rollback()
            error_msg = f"{exc}"[:500]
            logger.error(
                "Pipeline failed for interview %s: %s\n%s",
                interview_id,
                exc,
                traceback.format_exc(),
            )
            await self._set_status(interview_id, InterviewStatus.FAILED, error_msg)
            raise

    async def _generate_pdf(self, interview_id) -> None:
        """Generate and store the professional PDF report (imported lazily)."""
        from app.services.pdf_service import generate_interview_pdf

        await generate_interview_pdf(self.db, interview_id)


async def run_interview_pipeline(db: AsyncSession, interview_id, *, force_transcribe: bool = False) -> None:
    """Async entry point for background tasks / worker queue."""
    pipeline = InterviewPipeline(db)
    await pipeline.run(interview_id, force_transcribe=force_transcribe)


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
