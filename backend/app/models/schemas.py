from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class SessionResponse(BaseModel):
    id: UUID
    email: str
    role: str
    full_name: Optional[str] = None
    photo_url: Optional[str] = None


class JobResponse(BaseModel):
    id: UUID
    title: str
    company: str
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[list[str]] = None
    expectations: Optional[list[str]] = None
    is_active: bool


class InterviewUploadRequest(BaseModel):
    job_id: str


class InterviewStatusResponse(BaseModel):
    id: UUID
    status: str
    progress_pct: int


class CandidateListItem(BaseModel):
    id: UUID
    full_name: str
    email: str
    photo_url: Optional[str] = None
    job_title: Optional[str] = None
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    status: Optional[str] = None
    interview_date: Optional[str] = None


class CandidateListResponse(BaseModel):
    candidates: list[CandidateListItem]
    total: int


class EvidenceItem(BaseModel):
    quote: str
    timestamp: str


class EvaluationResponse(BaseModel):
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    confidence_score: Optional[float] = None
    problem_solving_score: Optional[float] = None
    experience_score: Optional[float] = None
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    strengths: Optional[list[str]] = None
    weaknesses: Optional[list[str]] = None
    ai_summary: Optional[str] = None
    evidence: Optional[dict] = None


class ReportResponse(BaseModel):
    candidate: CandidateListItem
    job: Optional[JobResponse] = None
    interview_status: Optional[str] = None
    interview_date: Optional[str] = None
    audio_url: Optional[str] = None
    transcript: Optional[dict] = None
    evaluation: Optional[EvaluationResponse] = None


class RecommendationOverride(BaseModel):
    recommendation: str


class CandidateInterviewItem(BaseModel):
    id: UUID
    job_title: str
    job_company: str
    status: str
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    interview_date: str
