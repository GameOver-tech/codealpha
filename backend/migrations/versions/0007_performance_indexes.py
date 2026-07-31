"""Add performance indexes on interviews.

Revision ID: 0007_performance_indexes
Revises: 0006_pdf_generation_meta
Create Date: 2026-07-31

Indexes added for the queries that run most often:
  - interviews.created_at — dashboard ordering / recent lists
  - interviews.status — status-count aggregation + status filters
  - interviews.candidate_id — per-candidate lookups (candidate dashboard)

"""
from typing import Sequence, Union

from alembic import op


revision: str = "0007_performance_indexes"
down_revision: Union[str, Sequence[str], None] = "0006_pdf_generation_meta"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE INDEX IF NOT EXISTS ix_interviews_created_at ON interviews (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_interviews_status ON interviews (status)")
    # ix_interviews_candidate_id already exists from 0001_initial — recreate is a no-op.
    op.execute("CREATE INDEX IF NOT EXISTS ix_interviews_candidate_id ON interviews (candidate_id)")


def downgrade() -> None:
    op.drop_index("ix_interviews_candidate_id", table_name="interviews")
    op.drop_index("ix_interviews_status", table_name="interviews")
    op.drop_index("ix_interviews_created_at", table_name="interviews")
