"""Services for moderation actions and enforcement."""
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import ForbiddenException, InvalidStateException, NotFoundException
from app.models.comment import Comment
from app.models.message import Message
from app.models.post import Post
from app.models.report import (
    ModerationAction,
    ModerationActionType,
    Report,
    ReportStatus,
    ReportTargetType,
)
from app.models.user import User


async def _get_user_or_404(db: AsyncSession, user_id: UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")
    return user


async def _resolve_target_user_from_report(db: AsyncSession, report: Report) -> UUID:
    if report.target_type == ReportTargetType.USER.value:
        return report.target_id

    if report.target_type == ReportTargetType.POST.value:
        post = (await db.execute(select(Post).where(Post.id == report.target_id))).scalar_one_or_none()
        if not post:
            raise NotFoundException("Reported post not found")
        return post.author_id

    if report.target_type == ReportTargetType.COMMENT.value:
        comment = (await db.execute(select(Comment).where(Comment.id == report.target_id))).scalar_one_or_none()
        if not comment:
            raise NotFoundException("Reported comment not found")
        return comment.author_id

    if report.target_type == ReportTargetType.MESSAGE.value:
        message = (await db.execute(select(Message).where(Message.id == report.target_id))).scalar_one_or_none()
        if not message:
            raise NotFoundException("Reported message not found")
        return message.sender_id

    raise InvalidStateException("Unsupported report target type")


async def apply_moderation_action(
    db: AsyncSession,
    acted_by: UUID,
    action: ModerationActionType,
    reason: str,
    duration_hours: int | None = None,
    report: Report | None = None,
    target_user_id: UUID | None = None,
) -> tuple[ModerationAction, User]:
    """Apply moderation action and update relevant report status."""
    if report is None and target_user_id is None:
        raise InvalidStateException("Either report or target_user_id is required")

    if target_user_id is None and report is not None:
        target_user_id = await _resolve_target_user_from_report(db, report)

    if target_user_id is None:
        raise InvalidStateException("Target user could not be resolved")

    if acted_by == target_user_id:
        raise ForbiddenException("Moderator cannot act on themselves")

    target_user = await _get_user_or_404(db, target_user_id)

    # Fetch the acting moderator to check privilege level
    actor = await _get_user_or_404(db, acted_by)
    actor_is_admin = any(
        role in {UserRole.ADMIN.value, UserRole.HEAD_ADMIN.value}
        for role in actor.roles
    )
    target_is_privileged = any(
        role in {UserRole.MODERATOR.value, UserRole.ADMIN.value, UserRole.HEAD_ADMIN.value}
        for role in target_user.roles
    )
    if not actor_is_admin and target_is_privileged:
        raise ForbiddenException("Insufficient privileges to act on this user")

    expires_at = None

    if action == ModerationActionType.WARN:
        pass
    elif action == ModerationActionType.RESTRICT:
        applied_hours = duration_hours or 24
        expires_at = datetime.now(UTC) + timedelta(hours=applied_hours)
        target_user.suspended_until = expires_at
    elif action == ModerationActionType.SUSPEND:
        applied_hours = duration_hours or 24
        expires_at = datetime.now(UTC) + timedelta(hours=applied_hours)
        target_user.is_active = False
        target_user.suspended_until = expires_at
    elif action == ModerationActionType.BAN:
        target_user.is_active = False
        target_user.suspended_until = None
    elif action == ModerationActionType.DISMISS:
        pass
    else:
        raise InvalidStateException("Unsupported moderation action")

    moderation_action = ModerationAction(
        report_id=report.id if report else None,
        target_user_id=target_user.id,
        acted_by=acted_by,
        action=action.value,
        reason=reason,
        duration_hours=duration_hours,
        expires_at=expires_at,
    )
    db.add(moderation_action)

    if report:
        if action == ModerationActionType.DISMISS:
            report.status = ReportStatus.DISMISSED.value
        else:
            report.status = ReportStatus.RESOLVED.value

    await db.flush()
    await db.refresh(target_user)
    await db.refresh(moderation_action)
    return moderation_action, target_user


async def list_moderation_actions(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[ModerationAction], int]:
    """List moderation actions newest first."""
    query = select(ModerationAction)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = await db.execute(
        query.order_by(ModerationAction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return list(rows.scalars().all()), total


async def get_report_for_action(db: AsyncSession, report_id: UUID) -> Report:
    """Fetch report for moderation action."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundException("Report not found")
    return report
