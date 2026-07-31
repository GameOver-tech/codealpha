"""Add Deepgram source fields to transcripts.

Revision ID: 0002_transcript_fields
Revises: 0001_initial
Create Date: 2026-07-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_transcript_fields"
down_revision: Union[str, Sequence[str], None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add language, confidence, source, and raw Deepgram response columns."""
    op.add_column("transcripts", sa.Column("language", sa.String(20), server_default="en", nullable=False))
    op.add_column("transcripts", sa.Column("confidence", sa.Float(), server_default="0", nullable=False))
    op.add_column("transcripts", sa.Column("source", sa.String(30), server_default="deepgram", nullable=False))
    op.add_column("transcripts", sa.Column("raw_response", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Drop the added columns."""
    op.drop_column("transcripts", "raw_response")
    op.drop_column("transcripts", "source")
    op.drop_column("transcripts", "confidence")
    op.drop_column("transcripts", "language")
