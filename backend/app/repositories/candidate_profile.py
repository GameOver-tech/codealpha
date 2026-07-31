"""Candidate profile repository."""
import uuid

from sqlalchemy import select

from app.models.candidate_profile import CandidateProfile
from app.repositories.base import BaseRepository


class CandidateProfileRepository(BaseRepository[CandidateProfile]):
    model = CandidateProfile

    async def get_by_user(self, user_id: uuid.UUID | str) -> CandidateProfile | None:
        return await self.get_by(user_id=user_id)

    async def upsert(self, user_id: uuid.UUID, data: dict) -> CandidateProfile:
        profile = await self.get_by_user(user_id)
        if profile:
            for key, value in data.items():
                setattr(profile, key, value)
            await self.db.flush()
            return profile
        profile = CandidateProfile(user_id=user_id, **data)
        return await self.add(profile)
