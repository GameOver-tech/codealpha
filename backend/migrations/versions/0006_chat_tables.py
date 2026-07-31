"""Stateless chat assistant — no persistence required.

Revision ID: 0006_chat_tables
Revises: 0005_admin_status
Create Date: 2026-07-31

The chat feature is stateless (client-sent history, live tool reads), so no
tables are created. This migration exists to keep the revision numbering the
history already expected; it is a no-op.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0006_chat_tables"
down_revision: Union[str, Sequence[str], None] = "0005_admin_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
