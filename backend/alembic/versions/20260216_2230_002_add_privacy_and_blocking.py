"""Add privacy and blocking tables

Revision ID: 002
Revises: 001
Create Date: 2026-02-16 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_privacy_settings table
    op.create_table(
        'user_privacy_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('show_email', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('show_phone', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('show_full_city', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_user_privacy_user', 'user_privacy_settings', ['user_id'], unique=True)

    # Create user_blocks table
    op.create_table(
        'user_blocks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('blocker_id', UUID(as_uuid=True), nullable=False),
        sa.Column('blocked_id', UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['blocker_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['blocked_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('blocker_id', 'blocked_id', name='uq_blocker_blocked'),
    )

    op.create_index('ix_user_blocks_blocker', 'user_blocks', ['blocker_id'])
    op.create_index('ix_user_blocks_blocked', 'user_blocks', ['blocked_id'])


def downgrade() -> None:
    op.drop_table('user_blocks')
    op.drop_table('user_privacy_settings')
