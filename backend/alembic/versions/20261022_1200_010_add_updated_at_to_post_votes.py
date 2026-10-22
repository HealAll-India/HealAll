"""Add the updated_at column post_verification_votes was created without.

Revision ID: 010
Revises: 009
Create Date: 2026-10-22

PostVerificationVote uses TimestampMixin (created_at + updated_at), but 008
created the table with created_at only, so every vote INSERT failed with
"column post_verification_votes.updated_at does not exist". Tests never saw it
because they build tables from the models. IF NOT EXISTS keeps this safe on a
database where the column was added by hand.
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE post_verification_votes "
        "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE post_verification_votes DROP COLUMN IF EXISTS updated_at")
