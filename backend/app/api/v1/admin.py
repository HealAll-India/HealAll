"""Admin-only endpoints."""

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_any_role
from app.core.after_response import after_response
from app.core.constants import UserRole
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    Under18CloseResponse,
    Under18SummaryResponse,
    Under18WarnResponse,
)
from app.services import admin_service, under_18_service

router = APIRouter(prefix="/admin", tags=["admin"])

_ADMIN_ROLES = [UserRole.ADMIN, UserRole.HEAD_ADMIN]
_HEAD_ADMIN = [UserRole.HEAD_ADMIN]


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    current_user: Annotated[User, Depends(require_any_role(_ADMIN_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminStatsResponse:
    """Platform-wide metrics for the admin dashboard. Requires ADMIN or HEAD_ADMIN."""
    return await admin_service.get_platform_stats(db)


@router.get("/under-18", response_model=Under18SummaryResponse)
async def get_under_18_summary(
    current_user: Annotated[User, Depends(require_any_role(_HEAD_ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Under18SummaryResponse:
    """How many accounts still say 13 to 17, and where each stands. Requires HEAD_ADMIN."""
    return Under18SummaryResponse(**asdict(await under_18_service.summary(db)))


@router.post("/under-18/warn", response_model=Under18WarnResponse)
async def warn_under_18(
    current_user: Annotated[User, Depends(require_any_role(_HEAD_ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Under18WarnResponse:
    """Email the warning to members on 13 to 17 not yet warned. Requires HEAD_ADMIN."""
    result = await under_18_service.send_warnings(db)
    await db.commit()
    return Under18WarnResponse(**asdict(result))


@router.post("/under-18/close", response_model=Under18CloseResponse)
async def close_under_18(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_any_role(_HEAD_ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Under18CloseResponse:
    """Delete accounts warned a full week ago that still say 13 to 17. Requires HEAD_ADMIN."""
    result = await under_18_service.close_due(db)
    await db.commit()
    if result.files:
        await after_response(background_tasks, under_18_service.remove_files, result.files)
    return Under18CloseResponse(closed=result.closed)
