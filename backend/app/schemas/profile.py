"""Pydantic schemas for candidate profile + recommendation UI messages."""
import uuid

from pydantic import BaseModel, ConfigDict


class ProfileUpdate(BaseModel):
    experience: str = ""
    skills: str = ""
    education: str = ""
    current_company: str = ""
    expected_salary: str = ""


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    experience: str
    skills: str
    education: str
    current_company: str
    expected_salary: str
    profile_picture_url: str
    resume_url: str


class RecommendationMessage(BaseModel):
    verdict: str
    message: str
