"""Invite code service."""
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ExpiredException, NotFoundException
from app.core.security import generate_invite_code
from app.models.invite import InviteCode


async def create_invite_code(
    db: AsyncSession,
    created_by: UUID,
    max_uses: int = 1,
    expires_in_days: int = 30,
) -> InviteCode:
    """Create a new invite code."""
    code = generate_invite_code()
    expires_at = datetime.now(UTC) + timedelta(days=expires_in_days)

    invite = InviteCode(
        code=code,
        created_by=created_by,
        max_uses=max_uses,
        expires_at=expires_at,
    )

    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    return invite


async def get_invite_by_code(db: AsyncSession, code: str) -> InviteCode:
    """Get invite code by code string."""
    result = await db.execute(
        select(InviteCode).where(InviteCode.code == code, InviteCode.revoked == False)  # noqa: E712
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise NotFoundException("Invite code not found or revoked")

    return invite


async def validate_and_use_invite(db: AsyncSession, code: str) -> InviteCode:
    """Validate an invite code and increment use count."""
    invite = await get_invite_by_code(db, code)

    if not invite.is_available:
        if invite.is_expired:
            raise ExpiredException("Invite code has expired")
        raise ExpiredException("Invite code has been fully used")

    invite.use()
    await db.flush()
    await db.refresh(invite)

    return invite


async def list_invites(
    db: AsyncSession,
    created_by: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[InviteCode]:
    """List invite codes with optional filtering."""
    query = select(InviteCode).order_by(InviteCode.created_at.desc())

    if created_by:
        query = query.where(InviteCode.created_by == created_by)

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    return list(result.scalars().all())


async def revoke_invite(db: AsyncSession, invite_id: UUID) -> InviteCode:
    """Revoke an invite code."""
    result = await db.execute(select(InviteCode).where(InviteCode.id == invite_id))
    invite = result.scalar_one_or_none()

    if not invite:
        raise NotFoundException("Invite code not found")

    invite.revoked = True
    await db.flush()
    await db.refresh(invite)

    return invite
