"""Moderation action endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_any_role
from app.core.constants import UserRole
from app.db.session import get_db
from app.models.user import User
from app.schemas.moderation import (
    CreateModerationActionRequest,
    ModerationActionListResponse,
    ModerationActionResponse,
)
from app.services import moderation_service

MODERATION_ROLES = [UserRole.MODERATOR, UserRole.ADMIN, UserRole.HEAD_ADMIN]

router = APIRouter(prefix="/moderation", tags=["moderation"])


@router.post(
    "/actions",
    response_model=ModerationActionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_role(MODERATION_ROLES))],
)
async def create_moderation_action(
    payload: CreateModerationActionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ModerationActionResponse:
    """Create moderation action and optionally resolve linked report."""
    report = None
    if payload.report_id:
        report = await moderation_service.get_report_for_action(db, payload.report_id)

    action, _target_user = await moderation_service.apply_moderation_action(
        db=db,
        acted_by=current_user.id,
        action=payload.action,
        reason=payload.reason,
        duration_hours=payload.duration_hours,
        report=report,
        target_user_id=payload.target_user_id,
    )
    await db.commit()

    return ModerationActionResponse(
        id=action.id,
        report_id=action.report_id,
        target_user_id=action.target_user_id,
        acted_by=action.acted_by,
        action=action.action,
        reason=action.reason,
        duration_hours=action.duration_hours,
        expires_at=action.expires_at,
        created_at=action.created_at,
    )


@router.get(
    "/actions",
    response_model=ModerationActionListResponse,
    dependencies=[Depends(require_any_role(MODERATION_ROLES))],
)
async def list_moderation_actions(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> ModerationActionListResponse:
    """List moderation action history."""
    actions, total = await moderation_service.list_moderation_actions(
        db=db,
        page=page,
        per_page=per_page,
    )

    items = [
        ModerationActionResponse(
            id=action.id,
            report_id=action.report_id,
            target_user_id=action.target_user_id,
            acted_by=action.acted_by,
            action=action.action,
            reason=action.reason,
            duration_hours=action.duration_hours,
            expires_at=action.expires_at,
            created_at=action.created_at,
        )
        for action in actions
    ]

    return ModerationActionListResponse(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        has_next=(page * per_page) < total,
    )
