"""Add users.under_18_warned_at for closing accounts made at 13 to 17.

Revision ID: 012
Revises: 011
Create Date: 2026-11-28

HealAll became 18+ on Nov 27, 2026. Members who signed up as 13 to 17 get
one warning email; this records when it went, so their accounts close no
sooner than a week later.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("under_18_warned_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "under_18_warned_at")
