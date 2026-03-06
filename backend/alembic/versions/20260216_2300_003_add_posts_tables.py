"""Add posts and post_media tables

Revision ID: 003
Revises: 002
Create Date: 2026-02-16 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create posts table
    op.create_table(
        'posts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('author_id', UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('urgency', sa.String(length=10), nullable=False, server_default='normal'),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='draft'),
        sa.Column('contact_prefs', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_posts_author_id', 'posts', ['author_id'])
    op.create_index('ix_posts_category', 'posts', ['category'])
    op.create_index('ix_posts_urgency', 'posts', ['urgency'])
    op.create_index('ix_posts_city', 'posts', ['city'])
    op.create_index('ix_posts_status', 'posts', ['status'])
    op.create_index(
        'idx_posts_feed',
        'posts',
        ['urgency', 'created_at'],
        postgresql_where=sa.text("status = 'active' AND deleted_at IS NULL"),
    )

    # Create post_media table
    op.create_table(
        'post_media',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('post_id', UUID(as_uuid=True), nullable=False),
        sa.Column('s3_key', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=50), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_post_media_post_id', 'post_media', ['post_id'])


def downgrade() -> None:
    op.drop_table('post_media')
    op.drop_table('posts')
