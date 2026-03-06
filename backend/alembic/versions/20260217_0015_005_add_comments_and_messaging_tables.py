"""Add comments and consent-based messaging tables

Revision ID: 005
Revises: 004
Create Date: 2026-02-17 00:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create comments table
    op.create_table(
        'comments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('post_id', UUID(as_uuid=True), nullable=False),
        sa.Column('author_id', UUID(as_uuid=True), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index(
        'idx_comments_post',
        'comments',
        ['post_id', 'created_at'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )
    op.create_index('ix_comments_author_id', 'comments', ['author_id'])

    # Create dm_consent_requests table
    op.create_table(
        'dm_consent_requests',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('from_user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('to_user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['from_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['to_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_dm_consent_requests_from_user_id', 'dm_consent_requests', ['from_user_id'])
    op.create_index('ix_dm_consent_requests_to_user_id', 'dm_consent_requests', ['to_user_id'])
    op.create_index('ix_dm_consent_requests_post_id', 'dm_consent_requests', ['post_id'])
    op.create_index('ix_dm_consent_requests_status', 'dm_consent_requests', ['status'])
    op.create_index(
        'idx_dm_consent_to',
        'dm_consent_requests',
        ['to_user_id', 'status'],
    )

    # Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('consent_id', UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('user_a', UUID(as_uuid=True), nullable=False),
        sa.Column('user_b', UUID(as_uuid=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['consent_id'], ['dm_consent_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_a'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_b'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_a', 'user_b', 'consent_id', name='uq_conversation_unique'),
    )

    op.create_index('ix_conversations_consent_id', 'conversations', ['consent_id'], unique=True)
    op.create_index('ix_conversations_user_a', 'conversations', ['user_a'])
    op.create_index('ix_conversations_user_b', 'conversations', ['user_b'])

    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', UUID(as_uuid=True), nullable=False),
        sa.Column('sender_id', UUID(as_uuid=True), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_messages_conversation_id', 'messages', ['conversation_id'])
    op.create_index('ix_messages_sender_id', 'messages', ['sender_id'])
    op.create_index('idx_messages_convo', 'messages', ['conversation_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('dm_consent_requests')
    op.drop_table('comments')
