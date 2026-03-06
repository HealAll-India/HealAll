"""Services for user moderation reports."""
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateException, NotFoundException, ValidationException
from app.models.comment import Comment
from app.models.message import Message
from app.models.post import Post
from app.models.report import Report, ReportStatus, ReportTargetType
from app.models.user import User


async def _validate_target_exists(db: AsyncSession, target_type: ReportTargetType, target_id: UUID) -> None:
    if target_type == ReportTargetType.POST:
        result = await db.execute(select(Post.id).where(Post.id == target_id, Post.deleted_at.is_(None)))
    elif target_type == ReportTargetType.COMMENT:
        result = await db.execute(
            select(Comment.id).where(Comment.id == target_id, Comment.deleted_at.is_(None))
        )
    elif target_type == ReportTargetType.MESSAGE:
        result = await db.execute(select(Message.id).where(Message.id == target_id))
    elif target_type == ReportTargetType.USER:
        result = await db.execute(select(User.id).where(User.id == target_id, User.deleted_at.is_(None)))
    else:
        raise ValidationException("Unsupported report target type")

    if result.scalar_one_or_none() is None:
        raise NotFoundException(f"{target_type.value} target not found")


async def create_report(
    db: AsyncSession,
    reporter_id: UUID,
    target_type: ReportTargetType,
    target_id: UUID,
    reason: str,
    description: str | None,
) -> Report:
    """Create report and reject duplicates by same reporter on same target."""
    await _validate_target_exists(db, target_type, target_id)

    # Prevent self-reporting when the target is a user
    if target_type == ReportTargetType.USER and target_id == reporter_id:
        raise ValidationException("You cannot report yourself")

    existing_result = await db.execute(
        select(Report.id).where(
            Report.reporter_id == reporter_id,
            Report.target_type == target_type.value,
            Report.target_id == target_id,
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise DuplicateException("You have already reported this target")

    report = Report(
        reporter_id=reporter_id,
        target_type=target_type.value,
        target_id=target_id,
        reason=reason,
        description=description,
        status=ReportStatus.PENDING.value,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report


async def get_report_by_id(db: AsyncSession, report_id: UUID) -> Report:
    """Get report by id."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundException("Report not found")
    return report


async def list_reports(
    db: AsyncSession,
    status: ReportStatus | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Report], int]:
    """List reports with optional status filter."""
    query = select(Report)
    if status:
        query = query.where(Report.status == status.value)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = await db.execute(
        query.order_by(Report.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    return list(rows.scalars().all()), total


async def update_report_status(db: AsyncSession, report: Report, status: ReportStatus) -> Report:
    """Update moderation status on report."""
    report.status = status.value
    await db.flush()
    await db.refresh(report)
    return report
