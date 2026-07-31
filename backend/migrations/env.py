"""Alembic environment — async engine with PostgreSQL UUID/ENUM support.

This module runs from the ``backend/`` directory (alembic.ini sets
prepend_sys_path = .), so ``app`` and ``migrations`` are importable.
"""
import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Ensure the backend/ directory is on sys.path when alembic is run from elsewhere.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("APP_ENV", os.environ.get("APP_ENV", "development"))

from app.core.config import settings  # noqa: E402
from app.models.base import Base  # noqa: E402
import app.models  # noqa: E402,F401  (register all models with Base.metadata)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the URL without configparser %-interpolation issues (e.g. URL-encoded
# passwords containing '%40' — doubled to '%%40' so configparser passes it
# through literally).
config.set_section_option(
    config.config_ini_section,
    "sqlalchemy.url",
    settings.DATABASE_URL.replace("%", "%%"),
)

target_metadata = Base.metadata


def _register_pg_types(connection: Connection) -> None:
    """Register PostgreSQL UUID/ENUM type handling on the async driver."""
    from sqlalchemy import types
    from sqlalchemy.dialects.postgresql import UUID

    connection.dialect.ischema_names["uuid"] = UUID
    connection.dialect.ischema_names["enum"] = types.Enum


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL without a DB)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    _register_pg_types(connection)
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine from the config and run migrations."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
