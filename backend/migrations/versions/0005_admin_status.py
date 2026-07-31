"""Add admin_status to interviews.

Revision ID: 0005_admin_status
Revises: 0004_interview_progress_fields
Create Date: 2026-07-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_admin_status"
down_revision: Union[str, Sequence[str], None] = "0004_interview_progress_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "interviews",
        sa.Column("admin_status", sa.String(50), nullable=False, server_default="Pending"),
    )


def downgrade() -> None:
    op.drop_column("interviews", "admin_status")
