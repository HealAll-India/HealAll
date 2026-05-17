"""Community verification endpoints — peer voting on submitted posts."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.exceptions import ForbiddenException
from app.db.session import get_db
from app.models.post import PostStatus
from app.models.user import User
from app.schemas.community_verification import (
    CommunityQueueResponse,
    CommunityVoteItem,
    CommunityVoteRequest,
    CommunityVoteResult,
    CommunityVoteSummary,
)
from app.schemas.post import AuthorInfo
from app.services import community_verification_service

router = APIRouter(prefix="/community-verification", tags=["community-verification"])


def _require_l1(user: User) -> None:
    """Route-layer guard mirroring the service-layer L1+ check.

    Per project guideline: RBAC checks must be duplicated at the route layer
    for defence-in-depth.
    """
    if user.verification_level < 1:
        raise ForbiddenException("Only verified members (L1+) can access community verification")


def _votes_to_summary(votes: dict[str, int], threshold: int) -> CommunityVoteSummary:
    return CommunityVoteSummary(
        approve=votes.get("approve", 0),
        reject=votes.get("reject", 0),
        needs_info=votes.get("needs_info", 0),
        threshold=threshold,
    )


@router.get("/queue", response_model=CommunityQueueResponse)
async def get_community_queue(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
) -> CommunityQueueResponse:
    """List posts the current user can vote on (SUBMITTED, not own, not voted)."""
    _require_l1(current_user)
    threshold = get_settings().COMMUNITY_VERIFY_THRESHOLD
    posts, total = await community_verification_service.list_pending_for_user(
        db, current_user.id, page=page, per_page=per_page
    )

    author_ids = list({p.author_id for p in posts})
    author_map: dict[UUID, User] = {}
    if author_ids:
        rows = await db.execute(select(User).where(User.id.in_(author_ids)))
        author_map = {u.id: u for u in rows.scalars().all()}

    # Batch vote tallies for the entire page in a single query — avoids the
    # N+1 trip that calling get_vote_summary per post would cause.
    post_ids = [p.id for p in posts]
    summaries = await community_verification_service.get_vote_summaries_for_posts(db, post_ids)

    items: list[CommunityVoteItem] = []
    for post in posts:
        author = author_map.get(post.author_id)
        if not author:
            continue
        summary = summaries.get(post.id, {})
        items.append(
            CommunityVoteItem(
                post_id=post.id,
                title=post.title,
                description=post.description,
                category=post.category,
                urgency=post.urgency,
                city=post.city,
                address=post.address,
                pincode=post.pincode,
                latitude=post.latitude,
                longitude=post.longitude,
                author=AuthorInfo(
                    id=author.id,
                    name=author.name,
                    verification_level=author.verification_level,
                ),
                submitted_at=post.updated_at,
                votes=_votes_to_summary(summary, threshold),
            )
        )

    return CommunityQueueResponse(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        has_next=(page * per_page) < total,
        threshold=threshold,
    )


@router.post(
    "/{post_id}/vote",
    response_model=CommunityVoteResult,
    status_code=status.HTTP_201_CREATED,
)
async def cast_community_vote(
    post_id: UUID,
    payload: CommunityVoteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CommunityVoteResult:
    """Cast a vote on a submitted post."""
    _require_l1(current_user)
    threshold = get_settings().COMMUNITY_VERIFY_THRESHOLD
    post, _vote, _case = await community_verification_service.cast_vote(
        db, post_id, current_user, payload.decision, payload.reason
    )
    await db.commit()

    summary = await community_verification_service.get_vote_summary(db, post.id)

    return CommunityVoteResult(
        post_id=post.id,
        decision=payload.decision,
        new_status=PostStatus(post.status),
        votes=_votes_to_summary(summary, threshold),
        promoted_to_active=(post.status == PostStatus.ACTIVE.value),
    )
