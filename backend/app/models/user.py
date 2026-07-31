"""User model — one row per authenticated user (id matches Supabase auth.users)."""
import enum
import uuid

from sqlalchemy import Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CANDIDATE = "candidate"


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=UserRole.CANDIDATE,
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    gender: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Supabase auth uid when the user authenticates through Supabase Auth.
    auth_uid: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    profile: Mapped["CandidateProfile | None"] = relationship(  # noqa: F821
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    interviews: Mapped[list["Interview"]] = relationship(  # noqa: F821
        back_populates="candidate"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
