"""Repositories for analysis artifacts (transcript, speech, sentiment, scores, etc.)."""
import uuid

from sqlalchemy import delete, select

from app.models.base import Base
from app.models.interview_report import InterviewReport
from app.models.interview_scores import InterviewScores
from app.models.recommendation import Recommendation
from app.models.sentiment_analysis import SentimentAnalysis
from app.models.speech_analysis import SpeechAnalysis
from app.models.strength import Strength, Weakness
from app.models.technical_evaluation import TechnicalEvaluation
from app.models.transcript import Transcript
from app.repositories.base import BaseRepository, _coerce_uuid


class TranscriptRepository(BaseRepository[Transcript]):
    model = Transcript

    async def get_by_interview(self, interview_id) -> Transcript | None:
        return await self.get_by(interview_id=_coerce_uuid(interview_id))

    async def upsert(self, interview_id: uuid.UUID, data: dict) -> Transcript:
        """Upsert a transcript from the transcription result dict."""
        interview_id = _coerce_uuid(interview_id)
        row = await self.get_by_interview(interview_id)
        if row:
            for key, value in data.items():
                setattr(row, key, value)
            await self.db.flush()
            return row
        return await self.add(Transcript(interview_id=interview_id, **data))


class SpeechAnalysisRepository(BaseRepository[SpeechAnalysis]):
    model = SpeechAnalysis

    async def get_by_interview(self, interview_id) -> SpeechAnalysis | None:
        return await self.get_by(interview_id=_coerce_uuid(interview_id))

    async def upsert(self, interview_id: uuid.UUID, data: dict) -> SpeechAnalysis:
        interview_id = _coerce_uuid(interview_id)
        row = await self.get_by_interview(interview_id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
            await self.db.flush()
            return row
        return await self.add(SpeechAnalysis(interview_id=interview_id, **data))


class SentimentAnalysisRepository(BaseRepository[SentimentAnalysis]):
    model = SentimentAnalysis

    async def get_by_interview(self, interview_id) -> SentimentAnalysis | None:
        return await self.get_by(interview_id=_coerce_uuid(interview_id))

    async def upsert(self, interview_id: uuid.UUID, data: dict) -> SentimentAnalysis:
        interview_id = _coerce_uuid(interview_id)
        row = await self.get_by_interview(interview_id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
            await self.db.flush()
            return row
        return await self.add(SentimentAnalysis(interview_id=interview_id, **data))


class TechnicalEvaluationRepository(BaseRepository[TechnicalEvaluation]):
    model = TechnicalEvaluation

    async def get_by_interview(self, interview_id) -> TechnicalEvaluation | None:
        return await self.get_by(interview_id=_coerce_uuid(interview_id))

    async def upsert(self, interview_id: uuid.UUID, data: dict) -> TechnicalEvaluation:
        interview_id = _coerce_uuid(interview_id)
        row = await self.get_by_interview(interview_id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
            await self.db.flush()
            return row
        return await self.add(TechnicalEvaluation(interview_id=interview_id, **data))


class InterviewScoresRepository(BaseRepository[InterviewScores]):
    model = InterviewScores

    async def get_by_interview(self, interview_id) -> InterviewScores | None:
        return await self.get_by(interview_id=_coerce_uuid(interview_id))

    async def upsert(self, interview_id: uuid.UUID, data: dict) -> InterviewScores:
        interview_id = _coerce_uuid(interview_id)
        row = await self.get_by_interview(interview_id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
            await self.db.flush()
            return row
        return await self.add(InterviewScores(interview_id=interview_id, **data))


class StrengthRepository(BaseRepository[Strength]):
    model = Strength

    async def replace_for_interview(self, interview_id: uuid.UUID, items: list[str]) -> None:
        interview_id = _coerce_uuid(interview_id)
        await self.db.execute(delete(Strength).where(Strength.interview_id == interview_id))
        await self.db.flush()
        for text in items:
            if text.strip():
                self.db.add(Strength(interview_id=interview_id, text=text.strip()))
        await self.db.flush()

    async def list_by_interview(self, interview_id) -> list[Strength]:
        stmt = select(Strength).where(Strength.interview_id == _coerce_uuid(interview_id))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class WeaknessRepository(BaseRepository[Weakness]):
    model = Weakness

    async def replace_for_interview(self, interview_id: uuid.UUID, items: list[str]) -> None:
        interview_id = _coerce_uuid(interview_id)
        await self.db.execute(delete(Weakness).where(Weakness.interview_id == interview_id))
        await self.db.flush()
        for text in items:
            if text.strip():
                self.db.add(Weakness(interview_id=interview_id, text=text.strip()))
        await self.db.flush()

    async def list_by_interview(self, interview_id) -> list[Weakness]:
        stmt = select(Weakness).where(Weakness.interview_id == _coerce_uuid(interview_id))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class RecommendationRepository(BaseRepository[Recommendation]):
    model = Recommendation

    async def get_by_interview(self, interview_id) -> Recommendation | None:
        return await self.get_by(interview_id=_coerce_uuid(interview_id))

    async def upsert(self, interview_id: uuid.UUID, verdict, reason: str) -> Recommendation:
        """Upsert the recommendation, normalizing verdict to the enum.

        Accepts either a RecommendationVerdict member or its string value so
        callers can pass ``rec["verdict"]`` (a string) safely.
        """
        from app.models.recommendation import RecommendationVerdict

        interview_id = _coerce_uuid(interview_id)
        if isinstance(verdict, RecommendationVerdict):
            normalized = verdict
        else:
            normalized = RecommendationVerdict(str(verdict).strip())
        row = await self.get_by_interview(interview_id)
        if row:
            row.verdict = normalized
            row.reason = reason
            await self.db.flush()
            return row
        return await self.add(
            Recommendation(interview_id=interview_id, verdict=normalized, reason=reason)
        )


class InterviewReportRepository(BaseRepository[InterviewReport]):
    model = InterviewReport

    async def get_by_interview(self, interview_id) -> InterviewReport | None:
        return await self.get_by(interview_id=_coerce_uuid(interview_id))

    async def upsert(self, interview_id: uuid.UUID, data: dict) -> InterviewReport:
        interview_id = _coerce_uuid(interview_id)
        row = await self.get_by_interview(interview_id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
            await self.db.flush()
            return row
        return await self.add(InterviewReport(interview_id=interview_id, **data))
