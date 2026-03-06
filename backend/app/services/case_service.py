"""Services for case lifecycle management."""
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import DuplicateException, ForbiddenException, InvalidStateException, NotFoundException
from app.models.case import Case, CaseClosure, CaseHelper, CaseHelperStatus, CaseNote, CaseStatus
from app.models.post import Post
from app.models.user import User
from app.models.verification import Verification

ADMIN_ROLES = {
    UserRole.ADMIN.value,
    UserRole.HEAD_ADMIN.value,
}
VERIFIER_ROLES = {
    UserRole.CASE_VERIFIER.value,
    UserRole.ADMIN.value,
    UserRole.HEAD_ADMIN.value,
}


def _has_any_role(user: User, roles: set[str]) -> bool:
    return any(role in roles for role in user.roles)


async def _get_case_and_post(db: AsyncSession, case_id: UUID) -> tuple[Case, Post]:
    result = await db.execute(
        select(Case, Post)
        .join(Post, Case.post_id == Post.id)
        .where(Case.id == case_id, Post.deleted_at.is_(None))
    )
    row = result.one_or_none()

    if not row:
        raise NotFoundException("Case not found")

    return row[0], row[1]


async def _is_case_team_member(db: AsyncSession, case: Case, post: Post, user: User) -> bool:
    if _has_any_role(user, ADMIN_ROLES):
        return True

    if post.author_id == user.id:
        return True

    if case.owner_id and case.owner_id == user.id:
        return True

    helper_result = await db.execute(
        select(CaseHelper.id).where(
            CaseHelper.case_id == case.id,
            CaseHelper.user_id == user.id,
            CaseHelper.status == CaseHelperStatus.ACTIVE.value,
        )
    )
    if helper_result.scalar_one_or_none() is not None:
        return True

    verifier_result = await db.execute(
        select(Verification.id).where(
            Verification.post_id == case.post_id,
            Verification.verifier_id == user.id,
        )
    )
    return verifier_result.scalar_one_or_none() is not None


async def _get_helper_counts(db: AsyncSession, case_ids: list[UUID]) -> dict[UUID, int]:
    if not case_ids:
        return {}

    result = await db.execute(
        select(CaseHelper.case_id, func.count(CaseHelper.id))
        .where(
            CaseHelper.case_id.in_(case_ids),
            CaseHelper.status == CaseHelperStatus.ACTIVE.value,
        )
        .group_by(CaseHelper.case_id)
    )
    return {row[0]: row[1] for row in result.all()}


async def list_cases_for_user(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[tuple[Case, Post]], int, dict[UUID, int]]:
    """List cases visible to the current user."""
    query = select(Case, Post).join(Post, Case.post_id == Post.id).where(Post.deleted_at.is_(None))

    if not _has_any_role(current_user, ADMIN_ROLES):
        helper_case_ids = select(CaseHelper.case_id).where(
            CaseHelper.user_id == current_user.id,
            CaseHelper.status == CaseHelperStatus.ACTIVE.value,
        )
        verified_post_ids = select(Verification.post_id).where(Verification.verifier_id == current_user.id)

        query = query.where(
            or_(
                Post.author_id == current_user.id,
                Case.owner_id == current_user.id,
                Case.id.in_(helper_case_ids),
                Case.post_id.in_(verified_post_ids),
            )
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    rows_result = await db.execute(
        query.order_by(Case.updated_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    rows = list(rows_result.all())

    helper_counts = await _get_helper_counts(db, [row[0].id for row in rows])
    return rows, total, helper_counts


async def get_case_detail(
    db: AsyncSession,
    case_id: UUID,
    current_user: User,
) -> tuple[Case, Post, int]:
    """Get case detail for users with access."""
    case, post = await _get_case_and_post(db, case_id)

    if not await _is_case_team_member(db, case, post, current_user):
        raise ForbiddenException("You don't have access to this case")

    helper_counts = await _get_helper_counts(db, [case.id])
    return case, post, helper_counts.get(case.id, 0)


async def update_case_owner(
    db: AsyncSession,
    case_id: UUID,
    current_user: User,
    owner_id: UUID | None,
) -> tuple[Case, Post, int]:
    """Assign or clear a case owner (verifier/admin only)."""
    if not _has_any_role(current_user, VERIFIER_ROLES):
        raise ForbiddenException("Only verifier/admin can assign a case owner")

    case, post = await _get_case_and_post(db, case_id)

    if owner_id is not None:
        owner_result = await db.execute(
            select(User).where(User.id == owner_id, User.deleted_at.is_(None))
        )
        owner = owner_result.scalar_one_or_none()
        if not owner:
            raise NotFoundException("Owner user not found")

    case.owner_id = owner_id
    await db.flush()
    await db.refresh(case)

    helper_counts = await _get_helper_counts(db, [case.id])
    return case, post, helper_counts.get(case.id, 0)


async def offer_help_on_case(db: AsyncSession, case_id: UUID, current_user: User) -> CaseHelper:
    """Offer help on an active/reopened case."""
    case, _ = await _get_case_and_post(db, case_id)

    if case.status in {CaseStatus.CLOSED.value, CaseStatus.CLOSURE_REQUESTED.value}:
        raise InvalidStateException("Cannot join a case that is closed or pending closure")

    existing_result = await db.execute(
        select(CaseHelper).where(
            CaseHelper.case_id == case_id,
            CaseHelper.user_id == current_user.id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing and existing.status == CaseHelperStatus.ACTIVE.value:
        raise DuplicateException("You have already offered help on this case")

    if existing:
        existing.status = CaseHelperStatus.ACTIVE.value
        existing.withdrawn_at = None
        existing.offered_at = datetime.now(UTC)
        helper = existing
    else:
        helper = CaseHelper(
            case_id=case_id,
            user_id=current_user.id,
            status=CaseHelperStatus.ACTIVE.value,
        )
        db.add(helper)

    await db.flush()
    await db.refresh(helper)
    return helper


async def withdraw_help_from_case(
    db: AsyncSession,
    case_id: UUID,
    helper_user_id: UUID,
    current_user: User,
) -> CaseHelper:
    """Withdraw helper membership from a case."""
    case, _ = await _get_case_and_post(db, case_id)

    actor_can_manage = (
        current_user.id == helper_user_id
        or (case.owner_id and current_user.id == case.owner_id)
        or _has_any_role(current_user, VERIFIER_ROLES)
    )
    if not actor_can_manage:
        raise ForbiddenException("Not allowed to withdraw this helper")

    helper_result = await db.execute(
        select(CaseHelper).where(
            CaseHelper.case_id == case_id,
            CaseHelper.user_id == helper_user_id,
            CaseHelper.status == CaseHelperStatus.ACTIVE.value,
        )
    )
    helper = helper_result.scalar_one_or_none()

    if not helper:
        raise NotFoundException("Active helper not found for this case")

    helper.status = CaseHelperStatus.WITHDRAWN.value
    helper.withdrawn_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(helper)

    return helper


async def add_case_note(
    db: AsyncSession,
    case_id: UUID,
    current_user: User,
    body: str,
    support_type: str | None,
    hours_contributed: float | None,
    attachment_s3_key: str | None,
) -> CaseNote:
    """Create a case note for case team members."""
    case, post = await _get_case_and_post(db, case_id)

    if not await _is_case_team_member(db, case, post, current_user):
        raise ForbiddenException("Only case team members can add notes")

    note = CaseNote(
        case_id=case_id,
        author_id=current_user.id,
        body=body,
        support_type=support_type,
        hours_contributed=hours_contributed,
        attachment_s3_key=attachment_s3_key,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)

    return note


async def list_case_notes(db: AsyncSession, case_id: UUID, current_user: User) -> list[CaseNote]:
    """List notes for case team members."""
    case, post = await _get_case_and_post(db, case_id)

    if not await _is_case_team_member(db, case, post, current_user):
        raise ForbiddenException("Only case team members can view notes")

    notes_result = await db.execute(
        select(CaseNote)
        .where(CaseNote.case_id == case_id)
        .order_by(CaseNote.created_at.desc())
    )
    return list(notes_result.scalars().all())


async def close_case(
    db: AsyncSession,
    case_id: UUID,
    current_user: User,
    resolution_type: str,
    closure_remarks: str,
    impact_story: str | None,
    impact_consent: bool,
) -> tuple[Case, CaseClosure]:
    """Create closure request or directly confirm closure (verifier/admin)."""
    case, post = await _get_case_and_post(db, case_id)

    can_confirm = _has_any_role(current_user, VERIFIER_ROLES)
    can_request = current_user.id == post.author_id or (case.owner_id and current_user.id == case.owner_id)

    if not can_confirm and not can_request:
        raise ForbiddenException("Only case owner/help-seeker/verifier can close a case")

    if case.status == CaseStatus.CLOSED.value:
        raise InvalidStateException("Case is already closed")

    if not can_confirm and case.status == CaseStatus.CLOSURE_REQUESTED.value:
        raise InvalidStateException("Closure has already been requested")

    closure = CaseClosure(
        case_id=case.id,
        closed_by=current_user.id,
        confirmed_by=current_user.id if can_confirm else None,
        resolution_type=resolution_type,
        remarks=closure_remarks,
        impact_story=impact_story,
        impact_consent=impact_consent,
    )
    db.add(closure)

    if can_confirm:
        case.status = CaseStatus.CLOSED.value
        case.closed_at = datetime.now(UTC)
        if case.closure_requested_by is None:
            case.closure_requested_by = current_user.id
        if case.closure_requested_at is None:
            case.closure_requested_at = datetime.now(UTC)
    else:
        case.status = CaseStatus.CLOSURE_REQUESTED.value
        case.closure_requested_by = current_user.id
        case.closure_requested_at = datetime.now(UTC)

    await db.flush()
    await db.refresh(case)
    await db.refresh(closure)

    return case, closure


async def reopen_case(db: AsyncSession, case_id: UUID, current_user: User) -> Case:
    """Reopen case by verifier/admin."""
    if not _has_any_role(current_user, VERIFIER_ROLES):
        raise ForbiddenException("Only verifier/admin can reopen cases")

    case, _ = await _get_case_and_post(db, case_id)

    if case.status not in {CaseStatus.CLOSED.value, CaseStatus.CLOSURE_REQUESTED.value}:
        raise InvalidStateException("Only closed or closure requested cases can be reopened")

    case.status = CaseStatus.REOPENED.value
    case.closed_at = None
    case.closure_requested_by = None
    case.closure_requested_at = None

    await db.flush()
    await db.refresh(case)

    return case
