"""Add post location columns + community verification votes table.

Revision ID: 008
Revises: 007
Create Date: 2026-05-17

- posts: address, pincode, latitude, longitude (all nullable for back-compat
  with existing rows; the API enforces "address + pincode" on new posts).
- post_verification_votes: per-user vote on a submitted post. Unique on
  (post_id, voter_id) prevents double-voting. N approvals (configurable;
  default 3) flip the post to ACTIVE.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Location columns on posts — all nullable for back-compat
    op.add_column("posts", sa.Column("address", sa.String(length=300), nullable=True))
    op.add_column("posts", sa.Column("pincode", sa.String(length=10), nullable=True))
    op.add_column("posts", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("posts", sa.Column("longitude", sa.Float(), nullable=True))
    op.create_index("ix_posts_pincode", "posts", ["pincode"])

    # 2. Community verification votes
    op.create_table(
        "post_verification_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "voter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("post_id", "voter_id", name="uq_post_vote_once_per_user"),
    )
    op.create_index("ix_post_votes_post", "post_verification_votes", ["post_id"])
    op.create_index("ix_post_votes_voter", "post_verification_votes", ["voter_id"])


def downgrade() -> None:
    op.drop_index("ix_post_votes_voter", table_name="post_verification_votes")
    op.drop_index("ix_post_votes_post", table_name="post_verification_votes")
    op.drop_table("post_verification_votes")

    op.drop_index("ix_posts_pincode", table_name="posts")
    op.drop_column("posts", "longitude")
    op.drop_column("posts", "latitude")
    op.drop_column("posts", "pincode")
    op.drop_column("posts", "address")
