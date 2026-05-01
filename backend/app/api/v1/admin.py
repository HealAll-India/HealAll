"""Admin-only endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_any_role
from app.core.constants import UserRole
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import AdminStatsResponse
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])

_ADMIN_ROLES = [UserRole.ADMIN, UserRole.HEAD_ADMIN]


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    current_user: Annotated[User, Depends(require_any_role(_ADMIN_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminStatsResponse:
    """Platform-wide metrics for the admin dashboard. Requires ADMIN or HEAD_ADMIN."""
    return await admin_service.get_platform_stats(db)
