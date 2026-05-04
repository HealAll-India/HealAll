"""Admin-only aggregate queries."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import Case, CaseStatus
from app.models.post import Post, PostStatus
from app.models.report import Report, ReportStatus
from app.models.user import User
from app.schemas.admin import AdminStatsResponse

_OPEN_CASE_STATUSES = {CaseStatus.ACTIVE.value, CaseStatus.CLOSURE_REQUESTED.value, CaseStatus.REOPENED.value}
_PENDING_REPORT_STATUSES = {ReportStatus.PENDING.value, ReportStatus.REVIEWING.value}


async def get_platform_stats(db: AsyncSession) -> AdminStatsResponse:
    """Return platform-wide counts for the admin dashboard. Single round-trip via subqueries."""
    total_users, verified_users, suspended_users = (
        await db.execute(
            select(
                func.count(User.id),
                func.count(User.id).filter(User.verification_level >= 1),
                func.count(User.id).filter(User.is_active.is_(False)),
            ).where(User.deleted_at.is_(None))
        )
    ).one()

    (active_posts,) = (
        await db.execute(
            select(func.count(Post.id)).where(
                Post.status == PostStatus.ACTIVE.value,
                Post.deleted_at.is_(None),
            )
        )
    ).one()

    (pending_verifications,) = (
        await db.execute(
            select(func.count(Post.id)).where(
                Post.status == PostStatus.SUBMITTED.value,
                Post.deleted_at.is_(None),
            )
        )
    ).one()

    (open_cases,) = (await db.execute(select(func.count(Case.id)).where(Case.status.in_(_OPEN_CASE_STATUSES)))).one()

    (pending_reports,) = (
        await db.execute(select(func.count(Report.id)).where(Report.status.in_(_PENDING_REPORT_STATUSES)))
    ).one()

    return AdminStatsResponse(
        total_users=total_users,
        verified_users=verified_users,
        suspended_users=suspended_users,
        active_posts=active_posts,
        open_cases=open_cases,
        pending_verifications=pending_verifications,
        pending_reports=pending_reports,
    )
