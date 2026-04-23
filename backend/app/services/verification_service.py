"""Services for verifier queue and decision actions."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidStateException, NotFoundException
from app.models.case import Case, CaseStatus
from app.models.post import Post, PostStatus
from app.models.verification import Verification, VerificationDecision

VERIFICATION_ALLOWED_FROM = {
    PostStatus.SUBMITTED.value,
    PostStatus.NEEDS_INFO.value,
}


async def get_pending_posts(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Post], int]:
    """Return posts waiting for a verifier decision."""
    query = select(Post).where(
        Post.status == PostStatus.SUBMITTED.value,
        Post.deleted_at.is_(None),
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(query.order_by(Post.created_at.asc()).offset((page - 1) * per_page).limit(per_page))
    posts = list(result.scalars().all())

    return posts, total


async def get_post_for_decision(db: AsyncSession, post_id: UUID) -> Post:
    """Load a post and validate that it can still be actioned by a verifier."""
    result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = result.scalar_one_or_none()

    if not post:
        raise NotFoundException("Post not found")

    if post.status not in VERIFICATION_ALLOWED_FROM:
        raise InvalidStateException("This post cannot be actioned from its current status")

    return post


async def apply_verification_decision(
    db: AsyncSession,
    post_id: UUID,
    verifier_id: UUID,
    decision: VerificationDecision,
    remarks: str,
    evidence_s3_key: str | None = None,
) -> tuple[Post, Verification, Case | None]:
    """Apply a decision, persist verification history, and create case on approval."""
    post = await get_post_for_decision(db, post_id)

    verification = Verification(
        post_id=post.id,
        verifier_id=verifier_id,
        decision=decision.value,
        remarks=remarks,
        evidence_s3_key=evidence_s3_key,
    )
    db.add(verification)

    created_case: Case | None = None
    if decision == VerificationDecision.VERIFIED:
        post.status = PostStatus.ACTIVE.value

        existing_case_result = await db.execute(select(Case).where(Case.post_id == post.id))
        existing_case = existing_case_result.scalar_one_or_none()

        if existing_case:
            created_case = existing_case
        else:
            created_case = Case(
                post_id=post.id,
                status=CaseStatus.ACTIVE.value,
            )
            db.add(created_case)

    elif decision == VerificationDecision.NEEDS_INFO:
        post.status = PostStatus.NEEDS_INFO.value
    elif decision == VerificationDecision.REJECTED:
        post.status = PostStatus.REJECTED.value
    else:
        raise InvalidStateException("Unsupported verification decision")

    await db.flush()
    await db.refresh(post)
    await db.refresh(verification)
    if created_case:
        await db.refresh(created_case)

    return post, verification, created_case
