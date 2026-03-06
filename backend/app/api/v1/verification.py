"""Verification queue endpoints."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_any_role
from app.core.constants import UserRole
from app.db.session import get_db
from app.models.user import User
from app.models.verification import VerificationDecision
from app.schemas.post import AuthorInfo
from app.schemas.verification import (
    VerificationActionRequest,
    VerificationActionResponse,
    VerificationQueueItem,
    VerificationQueueResponse,
)
from app.services import verification_service

VERIFIER_DEPENDENCY = Depends(
    require_any_role([UserRole.CASE_VERIFIER, UserRole.ADMIN, UserRole.HEAD_ADMIN])
)

router = APIRouter(prefix="/verification", tags=["verification"])


@router.get(
    "/queue",
    response_model=VerificationQueueResponse,
    dependencies=[VERIFIER_DEPENDENCY],
)
async def get_verification_queue(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
) -> VerificationQueueResponse:
    """List submitted posts pending verifier action."""
    posts, total = await verification_service.get_pending_posts(db, page=page, per_page=per_page)

    author_ids = list({post.author_id for post in posts})
    author_map: dict[UUID, User] = {}
    if author_ids:
        authors_result = await db.execute(select(User).where(User.id.in_(author_ids)))
        author_map = {author.id: author for author in authors_result.scalars().all()}

    items: list[VerificationQueueItem] = []
    for post in posts:
        author = author_map.get(post.author_id)
        if not author:
            continue
        items.append(
            VerificationQueueItem(
                post_id=post.id,
                title=post.title,
                category=post.category,
                urgency=post.urgency,
                city=post.city,
                author=AuthorInfo(
                    id=author.id,
                    name=author.name,
                    verification_level=author.verification_level,
                ),
                submitted_at=post.updated_at,
            )
        )

    return VerificationQueueResponse(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        has_next=(page * per_page) < total,
    )


@router.post(
    "/{post_id}/verify",
    response_model=VerificationActionResponse,
    dependencies=[VERIFIER_DEPENDENCY],
)
async def verify_post(
    post_id: UUID,
    payload: VerificationActionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VerificationActionResponse:
    """Approve a submitted post and create a case if needed."""
    post, action, created_case = await verification_service.apply_verification_decision(
        db=db,
        post_id=post_id,
        verifier_id=current_user.id,
        decision=VerificationDecision.VERIFIED,
        remarks=payload.remarks,
        evidence_s3_key=payload.evidence_s3_key,
    )
    await db.commit()

    return VerificationActionResponse(
        post_id=post.id,
        decision=action.decision,
        new_status=post.status,
        remarks=action.remarks,
        case_id=created_case.id if created_case else None,
        actioned_at=action.created_at,
    )


@router.post(
    "/{post_id}/request-info",
    response_model=VerificationActionResponse,
    dependencies=[VERIFIER_DEPENDENCY],
)
async def request_more_info(
    post_id: UUID,
    payload: VerificationActionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VerificationActionResponse:
    """Mark post as needs more info from seeker."""
    post, action, _ = await verification_service.apply_verification_decision(
        db=db,
        post_id=post_id,
        verifier_id=current_user.id,
        decision=VerificationDecision.NEEDS_INFO,
        remarks=payload.remarks,
        evidence_s3_key=payload.evidence_s3_key,
    )
    await db.commit()

    return VerificationActionResponse(
        post_id=post.id,
        decision=action.decision,
        new_status=post.status,
        remarks=action.remarks,
        case_id=None,
        actioned_at=action.created_at,
    )


@router.post(
    "/{post_id}/reject",
    response_model=VerificationActionResponse,
    dependencies=[VERIFIER_DEPENDENCY],
)
async def reject_post(
    post_id: UUID,
    payload: VerificationActionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VerificationActionResponse:
    """Reject submitted post with remarks."""
    post, action, _ = await verification_service.apply_verification_decision(
        db=db,
        post_id=post_id,
        verifier_id=current_user.id,
        decision=VerificationDecision.REJECTED,
        remarks=payload.remarks,
        evidence_s3_key=payload.evidence_s3_key,
    )
    await db.commit()

    return VerificationActionResponse(
        post_id=post.id,
        decision=action.decision,
        new_status=post.status,
        remarks=action.remarks,
        case_id=None,
        actioned_at=action.created_at,
    )
