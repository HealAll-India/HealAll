"""Invite code management endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_any_role
from app.core.constants import UserRole
from app.db.session import get_db
from app.models.user import User
from app.schemas.invite import CreateInviteRequest, InviteCodeResponse
from app.services import invite_service

router = APIRouter(prefix="/invites", tags=["invites"])


@router.post(
    "",
    response_model=InviteCodeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_role([UserRole.ADMIN, UserRole.HEAD_ADMIN]))],
)
async def create_invite(
    invite_data: CreateInviteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InviteCodeResponse:
    """
    Create a new invite code (admin only).
    """
    invite = await invite_service.create_invite_code(
        db,
        created_by=current_user.id,
        max_uses=invite_data.max_uses,
        expires_in_days=invite_data.expires_in_days,
    )

    await db.commit()

    return InviteCodeResponse(
        id=invite.id,
        code=invite.code,
        max_uses=invite.max_uses,
        use_count=invite.use_count,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
        is_available=invite.is_available,
    )


@router.get(
    "",
    response_model=list[InviteCodeResponse],
    dependencies=[Depends(require_any_role([UserRole.ADMIN, UserRole.HEAD_ADMIN]))],
)
async def list_invites(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
) -> list[InviteCodeResponse]:
    """
    List all invite codes (admin only).
    """
    invites = await invite_service.list_invites(db, limit=limit, offset=offset)

    return [
        InviteCodeResponse(
            id=invite.id,
            code=invite.code,
            max_uses=invite.max_uses,
            use_count=invite.use_count,
            expires_at=invite.expires_at,
            created_at=invite.created_at,
            is_available=invite.is_available,
        )
        for invite in invites
    ]


@router.delete(
    "/{invite_id}",
    dependencies=[Depends(require_any_role([UserRole.ADMIN, UserRole.HEAD_ADMIN]))],
)
async def revoke_invite(
    invite_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """
    Revoke an invite code (admin only).
    """
    await invite_service.revoke_invite(db, invite_id)
    await db.commit()

    return {"message": "Invite code revoked successfully"}
