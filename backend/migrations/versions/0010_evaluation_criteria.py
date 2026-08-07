"""Add evaluation_criteria to interviews.

Revision ID: 0010_evaluation_criteria
Revises: 0010_admin_status_sync
Create Date: 2026-08-02

Stores the competencies the admin selected for AI evaluation. Empty list
means "evaluate all 10 criteria" — existing interviews backfilled to [] keep
their original behavior.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0010_evaluation_criteria"
down_revision: Union[str, Sequence[str], None] = "0010_admin_status_sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "interviews",
        sa.Column(
            "evaluation_criteria",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )


def downgrade() -> None:
    op.drop_column("interviews", "evaluation_criteria")
