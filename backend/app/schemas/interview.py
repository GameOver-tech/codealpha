"""Pydantic schemas for interviews, files, transcripts, analysis, scores, results."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for ORM-backed response models.

    Pydantic v2 does not coerce uuid.UUID -> str automatically, so id
    fields are typed as UUID and serialized to strings in JSON output.
    """

    model_config = ConfigDict(from_attributes=True)


# --- Interview ---
class InterviewStatusOut(ORMModel):
    id: uuid.UUID
    title: str
    status: str
    job_title: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    duration_seconds: int = 0
    error_message: str = ""
    failure_reason: str = ""
    failure_stage: str = ""
    processing_finished_at: datetime | None = None
    recommendation: str | None = None


class UploadResponse(BaseModel):
    interview_id: str
    file_id: str
    status: str = "uploaded"
    message: str = "Upload successful. Processing will start automatically."


# --- Transcript ---
class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    speaker: str | None = None
    confidence: float = 0.0


class TranscriptOut(ORMModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    full_text: str
    segments: list[TranscriptSegment] = []
    speakers: list[str] = []
    language: str = "en"
    confidence: float = 0.0
    source: str = "deepgram"


# --- Speech Analysis ---
class SpeechAnalysisOut(ORMModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    speech_speed_wpm: float
    avg_pause_seconds: float
    total_pauses: int
    speaking_rate: float
    confidence: float
    tone: str
    emotion: str
    clarity: float
    fluency: float
    energy: float
    notes: str


# --- Sentiment Analysis ---
class SentimentAnalysisOut(ORMModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    sentiment: str
    emotion: str
    confidence: float
    professionalism: float
    summary: str


# --- Scores ---
class ScoresOut(ORMModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    technical_skills: float
    communication: float
    confidence: float
    problem_solving: float
    relevant_experience: float
    leadership: float
    teamwork: float
    critical_thinking: float
    behavior: float
    professionalism: float
    overall_score: float


# --- Recommendation ---
class RecommendationOut(ORMModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    verdict: str
    reason: str
    message: str = ""


# --- Report ---
class ReportOut(ORMModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    executive_summary: str
    interview_overview: str
    candidate_overview: str
    performance_analysis: str
    technical_assessment: str
    communication_assessment: str
    confidence_assessment: str
    problem_solving_assessment: str
    experience_assessment: str
    improvement_suggestions: str


# --- Candidate result (view-only aggregation) ---
class InterviewResult(BaseModel):
    interview_id: str
    status: str
    candidate_name: str
    candidate_email: str
    interview_date: datetime | None = None
    duration_seconds: int = 0
    transcript: str = ""
    speech_analysis: SpeechAnalysisOut | None = None
    sentiment_analysis: SentimentAnalysisOut | None = None
    scores: ScoresOut | None = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    recommendation: RecommendationOut | None = None
    report: ReportOut | None = None
    pdf: PdfMeta | None = None


class PdfMeta(BaseModel):
    id: str
    filename: str
    url: str = ""


# --- Admin ---
class RegenerateRequest(BaseModel):
    interview_id: str


class AnalysisBundle(BaseModel):
    transcript: TranscriptOut | None = None
    speech_analysis: SpeechAnalysisOut | None = None
    sentiment_analysis: SentimentAnalysisOut | None = None
    technical_evaluation: dict[str, Any] | None = None
    scores: ScoresOut | None = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    recommendation: RecommendationOut | None = None
    report: ReportOut | None = None
