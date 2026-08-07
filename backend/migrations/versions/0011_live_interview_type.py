"""Add interview_type to interviews.

Revision ID: 0011_live_interview_type
Revises: 0010_evaluation_criteria
Create Date: 2026-08-02

Distinguishes admin-uploaded recordings ("recorded", the default) from
candidate self-service live AI interviews ("live"). Both flow through the
same processing pipeline — this column is purely descriptive/display.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0011_live_interview_type"
down_revision: Union[str, Sequence[str], None] = "0010_evaluation_criteria"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "interviews",
        sa.Column(
            "interview_type",
            sa.String(20),
            nullable=False,
            server_default="recorded",
        ),
    )


def downgrade() -> None:
    op.drop_column("interviews", "interview_type")
