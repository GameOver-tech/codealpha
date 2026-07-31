"""Add failure-tracking fields to interviews.

Revision ID: 0003_interview_failure_fields
Revises: 0002_transcript_fields
Create Date: 2026-07-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_interview_failure_fields"
down_revision: Union[str, Sequence[str], None] = "0002_transcript_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add failure tracking columns to interviews."""
    op.add_column("interviews", sa.Column("processing_finished_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("interviews", sa.Column("failure_reason", sa.String(1000), server_default="", nullable=False))
    op.add_column("interviews", sa.Column("failure_stage", sa.String(100), server_default="", nullable=False))
    op.add_column("interviews", sa.Column("failure_traceback", sa.String(4000), server_default="", nullable=False))


def downgrade() -> None:
    """Drop the added columns."""
    op.drop_column("interviews", "failure_traceback")
    op.drop_column("interviews", "failure_stage")
    op.drop_column("interviews", "failure_reason")
    op.drop_column("interviews", "processing_finished_at")
