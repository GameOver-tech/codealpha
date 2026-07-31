"""Register all ORM models so Alembic autogenerate sees them."""
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.models.user import User, UserRole
from app.models.candidate_profile import CandidateProfile
from app.models.interview import Interview, InterviewStatus
from app.models.job import Job
from app.models.interview_file import InterviewFile
from app.models.transcript import Transcript
from app.models.speech_analysis import SpeechAnalysis
from app.models.sentiment_analysis import SentimentAnalysis
from app.models.technical_evaluation import TechnicalEvaluation
from app.models.interview_scores import InterviewScores
from app.models.strength import Strength, Weakness
from app.models.recommendation import Recommendation, RecommendationVerdict
from app.models.interview_report import InterviewReport
from app.models.generated_pdf import GeneratedPdf
from app.models.activity_log import ActivityLog
from app.models.chat import ChatConversation, ChatMessage

__all__ = [
    "Base",
    "UUIDMixin",
    "TimestampMixin",
    "User",
    "UserRole",
    "CandidateProfile",
    "Interview",
    "InterviewStatus",
    "Job",
    "InterviewFile",
    "Transcript",
    "SpeechAnalysis",
    "SentimentAnalysis",
    "TechnicalEvaluation",
    "InterviewScores",
    "Strength",
    "Weakness",
    "Recommendation",
    "RecommendationVerdict",
    "InterviewReport",
    "GeneratedPdf",
    "ActivityLog",
    "ChatConversation",
    "ChatMessage",
]
