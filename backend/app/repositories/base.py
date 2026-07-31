"""Generic async repository base (CRUD primitives)."""
import uuid
from typing import Any, Generic, TypeVar

from sqlalchemy import func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


def _coerce_uuid(value: Any) -> Any:
    """Convert a string id to uuid.UUID when the column is a UUID.

    asyncpg refuses string values bound to UUID columns, so repository
    calls must pass uuid.UUID objects. Non-UUID values (emails, etc.)
    pass through untouched.
    """
    if isinstance(value, str):
        try:
            return uuid.UUID(value)
        except (ValueError, AttributeError, TypeError):
            return value
    return value


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, id: uuid.UUID | str) -> ModelT | None:
        return await self.db.get(self.model, _coerce_uuid(id))

    async def get_by(self, **kwargs: Any) -> ModelT | None:
        kwargs = {key: _coerce_uuid(value) for key, value in kwargs.items()}
        stmt = select(self.model).filter_by(**kwargs).limit(1)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, order_by: str | None = None, desc: bool = False) -> list[ModelT]:
        stmt = select(self.model)
        if order_by:
            col = getattr(self.model, order_by)
            stmt = stmt.order_by(col.desc() if desc else col.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def add(self, instance: ModelT) -> ModelT:
        self.db.add(instance)
        await self.db.flush()
        return instance

    async def add_all(self, instances: list[ModelT]) -> list[ModelT]:
        self.db.add_all(instances)
        await self.db.flush()
        return instances

    async def update(self, id: uuid.UUID | str, **values: Any) -> ModelT | None:
        stmt = (
            update(self.model)
            .where(self.model.id == _coerce_uuid(id))
            .values(**values)
            .returning(self.model)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def delete(self, id: uuid.UUID | str) -> bool:
        stmt = delete(self.model).where(self.model.id == _coerce_uuid(id))
        result = await self.db.execute(stmt)
        return result.rowcount > 0

    async def count(self, **kwargs: Any) -> int:
        kwargs = {key: _coerce_uuid(value) for key, value in kwargs.items()}
        stmt = select(func.count()).select_from(self.model).filter_by(**kwargs)
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)
