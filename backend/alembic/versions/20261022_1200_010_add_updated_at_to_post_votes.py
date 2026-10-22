"""Add the updated_at column post_verification_votes was created without.

Revision ID: 010
Revises: 009
Create Date: 2026-10-22

PostVerificationVote uses TimestampMixin (created_at + updated_at), but 008
created the table with created_at only, so every vote INSERT failed with
"column post_verification_votes.updated_at does not exist". Tests never saw it
because they build tables from the models.

The upgrade also repairs a column someone may have added by hand: it backfills
NULLs from created_at, then enforces the model's DEFAULT now() and NOT NULL.
The downgrade deliberately keeps the column: every model version since 008
expects it, so dropping it would only re-break vote inserts.
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add (or repair) updated_at so it matches TimestampMixin."""
    op.execute("ALTER TABLE post_verification_votes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE")
    op.execute("UPDATE post_verification_votes SET updated_at = created_at WHERE updated_at IS NULL")
    op.execute("ALTER TABLE post_verification_votes ALTER COLUMN updated_at SET DEFAULT now()")
    op.execute("ALTER TABLE post_verification_votes ALTER COLUMN updated_at SET NOT NULL")


def downgrade() -> None:
    """Keep the column: code at every earlier revision since 008 needs it (see module docstring)."""
