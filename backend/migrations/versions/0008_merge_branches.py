"""Merge chat tables and PDF meta branches.

Revision ID: 0008_merge_branches
Revises: 0006_chat_tables, 0007_performance_indexes
Create Date: 2026-07-31

Both 0006_chat_tables and 0007_performance_indexes (via 0006_pdf_generation_meta)
descend from 0005_admin_status. This merge unifies the two heads so alembic
reports a single head revision.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_merge_branches"
down_revision: Union[str, Sequence[str], None] = (
    "0006_chat_tables",
    "0007_performance_indexes",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
