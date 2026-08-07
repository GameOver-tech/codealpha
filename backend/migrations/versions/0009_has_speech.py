"""Add has_speech to interviews.

Revision ID: 0009_has_speech
Revises: 0008_merge_branches
Create Date: 2026-08-02

Tracks whether the uploaded recording contained audible speech. When false,
the pipeline completes the interview WITHOUT generating transcript,
evaluation, AI analysis or PDF — the admin UI then shows a "no speech
detected" state instead of empty/meaningless analysis.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009_has_speech"
down_revision: Union[str, Sequence[str], None] = "0008_merge_branches"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "interviews",
        sa.Column("has_speech", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    # Removed the legacy "Pending" admin status — backfill any existing rows
    # to "Processing" so they no longer show a removed badge.
    op.execute("UPDATE interviews SET admin_status = 'Processing' WHERE admin_status = 'Pending'")


def downgrade() -> None:
    op.drop_column("interviews", "has_speech")
