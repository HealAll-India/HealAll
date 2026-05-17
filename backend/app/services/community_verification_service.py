"""Community verification — peer voting on submitted posts.

Trusted helpers (verification_level >= 1, no MODERATOR/ADMIN required) can
vote on posts in the SUBMITTED state. Once `COMMUNITY_VERIFY_THRESHOLD`
APPROVE votes have been cast by distinct users, the post is flipped to ACTIVE
and a Case is created automatically (mirroring `verification_service`).

Guards:
- Voter cannot be the author.
- Voter must have verification_level >= 1.
- One vote per user per post (DB UNIQUE constraint).
- Post must be in SUBMITTED status.
- Post row is SELECT ... FOR UPDATE locked before threshold transition to
  avoid two concurrent APPROVE votes both performing the side effects.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    ForbiddenException,
    InvalidStateException,
    NotFoundException,
)
from app.models.case import Case, CaseStatus
from app.models.post import Post, PostStatus, PostVerificationVote, VoteDecision
from app.models.user import User

PENDING_STATUS = PostStatus.SUBMITTED.value


async def list_pending_for_user(
    db: AsyncSession,
    voter_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Post], int]:
    """Posts the user can still vote on: SUBMITTED, not authored by them,
    not already voted on."""
    voted_subq = select(PostVerificationVote.post_id).where(PostVerificationVote.voter_id == voter_id).subquery()

    base = (
        select(Post)
        .where(
            Post.status == PENDING_STATUS,
            Post.deleted_at.is_(None),
            Post.author_id != voter_id,
            Post.id.notin_(select(voted_subq.c.post_id)),
        )
        .order_by(Post.updated_at.asc())
    )

    total_q = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_q.scalar_one()

    page_q = await db.execute(base.limit(per_page).offset((page - 1) * per_page))
    posts = list(page_q.scalars().all())
    return posts, total


async def get_vote_summary(db: AsyncSession, post_id: UUID) -> dict[str, int]:
    """Tally of votes per decision for a single post."""
    result = await db.execute(
        select(PostVerificationVote.decision, func.count(PostVerificationVote.id))
        .where(PostVerificationVote.post_id == post_id)
        .group_by(PostVerificationVote.decision)
    )
    summary = {d.value: 0 for d in VoteDecision}
    for decision, count in result.all():
        summary[decision] = count
    return summary


async def get_vote_summaries_for_posts(
    db: AsyncSession,
    post_ids: list[UUID],
) -> dict[UUID, dict[str, int]]:
    """Batched tally for a list of post IDs — one query, not N.

    Returns a map post_id -> {decision: count}. Posts with no votes get a
    zero-filled summary so callers can index without missing-key handling.
    """
    summaries: dict[UUID, dict[str, int]] = {pid: {d.value: 0 for d in VoteDecision} for pid in post_ids}
    if not post_ids:
        return summaries

    result = await db.execute(
        select(
            PostVerificationVote.post_id,
            PostVerificationVote.decision,
            func.count(PostVerificationVote.id),
        )
        .where(PostVerificationVote.post_id.in_(post_ids))
        .group_by(PostVerificationVote.post_id, PostVerificationVote.decision)
    )
    for post_id, decision, count in result.all():
        summaries[post_id][decision] = count
    return summaries


async def cast_vote(
    db: AsyncSession,
    post_id: UUID,
    voter: User,
    decision: VoteDecision,
    reason: str | None,
) -> tuple[Post, PostVerificationVote, Case | None]:
    """Record a community vote and promote the post if threshold is met.

    The Post row is locked with `with_for_update()` inside the active
    transaction; this serialises concurrent APPROVE votes so the threshold
    transition (status -> ACTIVE + Case creation) runs at most once.
    """
    if voter.verification_level < 1:
        raise ForbiddenException("Only verified members (L1+) can vote on community verification")

    # Lock the post row for the rest of this transaction — concurrent voters
    # will queue behind us, so only one of them can cross the threshold.
    post_result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)).with_for_update())
    post = post_result.scalar_one_or_none()
    if not post:
        raise NotFoundException("Post not found")

    if post.author_id == voter.id:
        raise ForbiddenException("You cannot vote on your own post")

    if post.status != PENDING_STATUS:
        raise InvalidStateException(f"Post is not pending community verification (status={post.status})")

    vote = PostVerificationVote(
        post_id=post.id,
        voter_id=voter.id,
        decision=decision.value,
        reason=(reason.strip() if reason else None),
    )
    db.add(vote)

    try:
        await db.flush()
    except IntegrityError as exc:
        # UNIQUE(post_id, voter_id) — user already voted.
        await db.rollback()
        raise ForbiddenException("You have already voted on this post") from exc

    created_case: Case | None = None

    # Threshold check on APPROVE votes. The FOR UPDATE lock above + the
    # status re-check below ensure idempotent promotion.
    if decision == VoteDecision.APPROVE:
        approve_count = await db.execute(
            select(func.count(PostVerificationVote.id)).where(
                PostVerificationVote.post_id == post.id,
                PostVerificationVote.decision == VoteDecision.APPROVE.value,
            )
        )
        threshold = get_settings().COMMUNITY_VERIFY_THRESHOLD
        if approve_count.scalar_one() >= threshold and post.status == PENDING_STATUS:
            post.status = PostStatus.ACTIVE.value
            existing_case = await db.execute(select(Case).where(Case.post_id == post.id))
            case_row = existing_case.scalar_one_or_none()
            if case_row:
                created_case = case_row
            else:
                created_case = Case(post_id=post.id, status=CaseStatus.ACTIVE.value)
                db.add(created_case)
            await db.flush()
            await db.refresh(post)

    await db.refresh(vote)
    if created_case:
        await db.refresh(created_case)
    return post, vote, created_case
