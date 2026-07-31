"""User repository."""
import uuid

from sqlalchemy import select

from app.models.user import User, UserRole
from app.repositories.base import BaseRepository, _coerce_uuid


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        return await self.get_by(email=email.lower().strip())

    async def get_by_auth_uid(self, auth_uid: str) -> User | None:
        return await self.get_by(auth_uid=_coerce_uuid(auth_uid))

    async def create_candidate(
        self,
        email: str,
        first_name: str,
        last_name: str,
        phone: str,
        gender: str,
        password_hash: str | None = None,
        auth_uid: str | None = None,
    ) -> User:
        user = User(
            email=email.lower().strip(),
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            gender=gender,
            password_hash=password_hash,
            auth_uid=_coerce_uuid(auth_uid) if auth_uid else None,
            role=UserRole.CANDIDATE,
        )
        return await self.add(user)

    async def set_role(self, user_id: uuid.UUID, role: UserRole) -> None:
        await self.update(user_id, role=role)
