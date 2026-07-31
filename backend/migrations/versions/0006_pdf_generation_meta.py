"""Add generated_at / generated_by to generated_pdfs.

Revision ID: 0006_pdf_generation_meta
Revises: 0005_admin_status
Create Date: 2026-07-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_pdf_generation_meta"
down_revision: Union[str, Sequence[str], None] = "0005_admin_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "generated_pdfs",
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "generated_pdfs",
        sa.Column("generated_by", sa.String(100), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("generated_pdfs", "generated_by")
    op.drop_column("generated_pdfs", "generated_at")
