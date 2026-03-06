"""Initial auth tables

Revision ID: 001
Revises:
Create Date: 2026-02-16 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('phone', sa.String(15), nullable=False, unique=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('age_range', sa.String(10), nullable=False),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('roles', ARRAY(sa.String(30)), nullable=False, server_default=sa.text("'{help_seeker}'")),
        sa.Column('verification_level', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('phone_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('suspended_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create indexes for users
    op.create_index('ix_users_phone', 'users', ['phone'])
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_city', 'users', ['city'], postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('ix_users_verification_level', 'users', ['verification_level'], postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('ix_users_roles', 'users', ['roles'], postgresql_using='gin', postgresql_where=sa.text('deleted_at IS NULL'))

    # Create user_skills table
    op.create_table(
        'user_skills',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('skill', sa.String(100), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'skill', name='uq_user_skill'),
    )

    op.create_index('ix_user_skills_user_id', 'user_skills', ['user_id'])

    # Create invite_codes table
    op.create_table(
        'invite_codes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('code', sa.String(20), nullable=False, unique=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.create_index('ix_invite_codes_code', 'invite_codes', ['code'], postgresql_where=sa.text('revoked = false'))

    # Create otp_attempts table
    op.create_table(
        'otp_attempts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('phone_or_email', sa.String(255), nullable=False),
        sa.Column('otp_hash', sa.String(128), nullable=False),
        sa.Column('purpose', sa.String(20), nullable=False, server_default="'signup'"),
        sa.Column('attempts', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.create_index(
        'ix_otp_attempts_lookup',
        'otp_attempts',
        ['phone_or_email', 'purpose'],
        postgresql_where=sa.text('verified_at IS NULL')
    )

    # Create refresh_tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(128), nullable=False, unique=True),
        sa.Column('family_id', UUID(as_uuid=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index(
        'ix_refresh_tokens_user',
        'refresh_tokens',
        ['user_id'],
        postgresql_where=sa.text('revoked_at IS NULL')
    )


def downgrade() -> None:
    op.drop_table('refresh_tokens')
    op.drop_table('otp_attempts')
    op.drop_table('invite_codes')
    op.drop_table('user_skills')
    op.drop_table('users')
