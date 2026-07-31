"""Add processing progress tracking fields to interviews.

Revision ID: 0004_interview_progress_fields
Revises: 0003_interview_failure_fields
Create Date: 2026-07-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_interview_progress_fields"
down_revision: Union[str, Sequence[str], None] = "0003_interview_failure_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add progress tracking columns to interviews."""
    op.add_column("interviews", sa.Column("processing_progress", sa.Integer(), server_default="0", nullable=False))
    op.add_column("interviews", sa.Column("current_stage", sa.String(100), server_default="", nullable=False))


def downgrade() -> None:
    """Drop the added columns."""
    op.drop_column("interviews", "current_stage")
    op.drop_column("interviews", "processing_progress")
