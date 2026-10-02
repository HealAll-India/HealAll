"""Add report_triage table for AI-assisted, human-decided report triage.

Revision ID: 009
Revises: 008
Create Date: 2026-10-02

One row per (report, content version). The AI fills the suggested_* columns;
only a moderator fills decided_by / decision / final_* / decided_at.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_triage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("model_severity", sa.String(length=10), nullable=False),
        sa.Column("suggested_severity", sa.String(length=10), nullable=False),
        sa.Column("suggested_category", sa.String(length=50), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("danger_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "decided_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("decision", sa.String(length=20), nullable=True),
        sa.Column("final_severity", sa.String(length=10), nullable=True),
        sa.Column("final_category", sa.String(length=50), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("report_id", "content_hash", name="uq_report_triage_version"),
    )
    op.create_index("ix_report_triage_report_id", "report_triage", ["report_id"])
    op.create_index("ix_report_triage_suggested_severity", "report_triage", ["suggested_severity"])
    op.create_index("ix_report_triage_decided_by", "report_triage", ["decided_by"])


def downgrade() -> None:
    op.drop_index("ix_report_triage_decided_by", table_name="report_triage")
    op.drop_index("ix_report_triage_suggested_severity", table_name="report_triage")
    op.drop_index("ix_report_triage_report_id", table_name="report_triage")
    op.drop_table("report_triage")
