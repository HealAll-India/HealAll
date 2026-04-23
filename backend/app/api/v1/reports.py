"""Moderation report endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_any_role
from app.core.constants import UserRole
from app.db.session import get_db
from app.models.report import ReportStatus
from app.models.user import User
from app.schemas.report import CreateReportRequest, ReportListResponse, ReportResponse
from app.services import report_service

MODERATION_ROLES = [UserRole.MODERATOR, UserRole.ADMIN, UserRole.HEAD_ADMIN]

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: CreateReportRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReportResponse:
    """Create moderation report for post/comment/message/user target."""
    report = await report_service.create_report(
        db=db,
        reporter_id=current_user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason.value,
        description=payload.description,
    )
    await db.commit()

    return ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        created_at=report.created_at,
    )


@router.get(
    "",
    response_model=ReportListResponse,
    dependencies=[Depends(require_any_role(MODERATION_ROLES))],
)
async def list_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: ReportStatus | None = Query(default=ReportStatus.PENDING),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> ReportListResponse:
    """List reports for moderators/admins (pending by default)."""
    reports, total = await report_service.list_reports(
        db=db,
        status=status,
        page=page,
        per_page=per_page,
    )

    items = [
        ReportResponse(
            id=report.id,
            reporter_id=report.reporter_id,
            target_type=report.target_type,
            target_id=report.target_id,
            reason=report.reason,
            description=report.description,
            status=report.status,
            created_at=report.created_at,
        )
        for report in reports
    ]

    return ReportListResponse(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        has_next=(page * per_page) < total,
    )
