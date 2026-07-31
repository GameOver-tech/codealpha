from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


# --- Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "CurrentUser"


class CurrentUser(BaseModel):
    id: str
    email: str
    role: str
    full_name: str
    avatar_url: str


# --- Jobs ---
class JobCreate(BaseModel):
    title: str
    description: str


class JobResponse(BaseModel):
    id: UUID
    title: str
    description: str
    is_active: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Interviews ---
class InterviewUploadResponse(BaseModel):
    interview_id: UUID
    status: str = "uploaded"


class InterviewResponse(BaseModel):
    id: UUID
    candidate_id: UUID
    job_id: UUID
    recording_url: str | None = None
    status: str
    error_message: str | None = None
    created_at: datetime | None = None
    transcript: Optional["TranscriptResponse"] = None
    evaluation: Optional["EvaluationResponse"] = None

    model_config = {"from_attributes": True}


# --- Transcripts ---
class TranscriptResponse(BaseModel):
    id: UUID
    interview_id: UUID
    transcript_text: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Evaluations ---
class EvaluationResponse(BaseModel):
    id: UUID
    interview_id: UUID
    overall_score: int | None = None
    recommendation: str | None = None
    technical_score: int | None = None
    communication_score: int | None = None
    confidence_score: int | None = None
    problem_solving_score: int | None = None
    experience_score: int | None = None
    strengths: list | None = None
    weaknesses: list | None = None
    summary: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Admin ---
class AdminCandidateSummary(BaseModel):
    id: UUID
    full_name: str
    email: str
    avatar_url: str | None = None
    job_title: str | None = None
    interview_status: str | None = None
    overall_score: int | None = None
    recommendation: str | None = None

    model_config = {"from_attributes": True}


class AdminCandidateDetail(BaseModel):
    id: UUID
    full_name: str
    email: str
    avatar_url: str | None = None
    job: JobResponse | None = None
    interview: InterviewResponse | None = None
    transcript: TranscriptResponse | None = None
    evaluation: EvaluationResponse | None = None
    recording_url: str | None = None

    model_config = {"from_attributes": True}


class ErrorResponse(BaseModel):
    detail: str
