"""Add reports and moderation actions tables

Revision ID: 006
Revises: 005
Create Date: 2026-02-17 00:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create reports table
    op.create_table(
        'reports',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('reporter_id', UUID(as_uuid=True), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', UUID(as_uuid=True), nullable=False),
        sa.Column('reason', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('reporter_id', 'target_type', 'target_id', name='uq_reporter_target'),
    )

    op.create_index('ix_reports_reporter_id', 'reports', ['reporter_id'])
    op.create_index('ix_reports_target_type', 'reports', ['target_type'])
    op.create_index('ix_reports_target_id', 'reports', ['target_id'])
    op.create_index('ix_reports_status', 'reports', ['status'])
    op.create_index('idx_reports_status_created', 'reports', ['status', 'created_at'])

    # Create moderation_actions table
    op.create_table(
        'moderation_actions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('report_id', UUID(as_uuid=True), nullable=True),
        sa.Column('target_user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('acted_by', UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('duration_hours', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['acted_by'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_moderation_actions_report_id', 'moderation_actions', ['report_id'])
    op.create_index('ix_moderation_actions_target_user_id', 'moderation_actions', ['target_user_id'])
    op.create_index('ix_moderation_actions_acted_by', 'moderation_actions', ['acted_by'])
    op.create_index('ix_moderation_actions_action', 'moderation_actions', ['action'])
    op.create_index('idx_moderation_actions_created', 'moderation_actions', ['created_at'])


def downgrade() -> None:
    op.drop_table('moderation_actions')
    op.drop_table('reports')
