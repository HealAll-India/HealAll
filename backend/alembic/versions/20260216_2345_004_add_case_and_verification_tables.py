"""Add verification and case lifecycle tables

Revision ID: 004
Revises: 003
Create Date: 2026-02-16 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create verifications table
    op.create_table(
        'verifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('post_id', UUID(as_uuid=True), nullable=False),
        sa.Column('verifier_id', UUID(as_uuid=True), nullable=False),
        sa.Column('decision', sa.String(length=20), nullable=False),
        sa.Column('remarks', sa.Text(), nullable=False),
        sa.Column('evidence_s3_key', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verifier_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_verifications_post_id', 'verifications', ['post_id'])
    op.create_index('ix_verifications_verifier_id', 'verifications', ['verifier_id'])
    op.create_index('ix_verifications_decision', 'verifications', ['decision'])

    # Create cases table
    op.create_table(
        'cases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('post_id', UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('owner_id', UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('closure_requested_by', UUID(as_uuid=True), nullable=True),
        sa.Column('closure_requested_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['closure_requested_by'], ['users.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_cases_post_id', 'cases', ['post_id'], unique=True)
    op.create_index('ix_cases_owner_id', 'cases', ['owner_id'])
    op.create_index('ix_cases_status', 'cases', ['status'])

    # Create case_helpers table
    op.create_table(
        'case_helpers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('offered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('withdrawn_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('case_id', 'user_id', name='uq_case_helper_membership'),
    )

    op.create_index('ix_case_helpers_case_id', 'case_helpers', ['case_id'])
    op.create_index('ix_case_helpers_user_id', 'case_helpers', ['user_id'])
    op.create_index('ix_case_helpers_status', 'case_helpers', ['status'])

    # Create case_notes table
    op.create_table(
        'case_notes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False),
        sa.Column('author_id', UUID(as_uuid=True), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('support_type', sa.String(length=50), nullable=True),
        sa.Column('hours_contributed', sa.Float(), nullable=True),
        sa.Column('attachment_s3_key', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_case_notes_case_id', 'case_notes', ['case_id'])
    op.create_index('ix_case_notes_author_id', 'case_notes', ['author_id'])

    # Create case_closures table
    op.create_table(
        'case_closures',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False),
        sa.Column('closed_by', UUID(as_uuid=True), nullable=False),
        sa.Column('confirmed_by', UUID(as_uuid=True), nullable=True),
        sa.Column('resolution_type', sa.String(length=30), nullable=False),
        sa.Column('remarks', sa.Text(), nullable=False),
        sa.Column('impact_story', sa.Text(), nullable=True),
        sa.Column('impact_consent', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['closed_by'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['confirmed_by'], ['users.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_case_closures_case_id', 'case_closures', ['case_id'])


def downgrade() -> None:
    op.drop_table('case_closures')
    op.drop_table('case_notes')
    op.drop_table('case_helpers')
    op.drop_table('cases')
    op.drop_table('verifications')
