"""Reconcile remote migration 0010_admin_status_sync.

Revision ID: 0010_admin_status_sync
Revises: 0009_has_speech
Create Date: 2026-08-02

This revision was applied to the remote Supabase database from another
machine/branch but its file is not present in this repository. Inspection of
the live schema shows it made no column changes beyond the local 0001-0009
chain (interviews/generated_pdfs columns all match). It is therefore a no-op
here — it exists purely so Alembic's version table can chain into the local
0010_evaluation_criteria migration.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = "0010_admin_status_sync"
down_revision: Union[str, Sequence[str], None] = "0009_has_speech"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op — the remote schema already matches the local 0001-0009 chain."""


def downgrade() -> None:
    """No-op."""
