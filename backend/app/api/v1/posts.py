"""Post endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import DuplicateException, NotFoundException
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.post import PostStatus
from app.models.user import User
from app.schemas.post import (
    AuthorInfo,
    CreatePostRequest,
    FeedResponse,
    PostResponse,
    PostSummary,
    UpdatePostRequest,
)
from app.services import post_service

router = APIRouter(prefix="/posts", tags=["posts"])


@limiter.limit("30/hour")
@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    request: Request,
    post_data: CreatePostRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PostResponse:
    """Create a new help request post."""
    post = await post_service.create_post(db, current_user.id, post_data)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return PostResponse(
        id=post.id,
        title=post.title,
        description=post.description,
        category=post.category,
        urgency=post.urgency,
        city=post.city,
        status=post.status,
        author=AuthorInfo(
            id=current_user.id,
            name=current_user.name,
            verification_level=current_user.verification_level,
        ),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PostResponse:
    """Get post details."""
    post = await post_service.get_post_by_id(db, post_id)

    # Only expose posts that are visible to the public; non-owners must not
    # see drafts, submitted, needs_info, or rejected posts.
    visible_statuses = {PostStatus.ACTIVE.value, PostStatus.RESOLVED.value}
    if post.status not in visible_statuses and post.author_id != current_user.id:
        raise NotFoundException("Post not found") from None

    # Get author info — use scalar_one_or_none to avoid 500 on deleted authors
    author_result = await db.execute(select(User).where(User.id == post.author_id))
    author = author_result.scalar_one_or_none()
    if not author:
        raise NotFoundException("Post not found") from None

    return PostResponse(
        id=post.id,
        title=post.title,
        description=post.description,
        category=post.category,
        urgency=post.urgency,
        city=post.city,
        status=post.status,
        author=AuthorInfo(
            id=author.id,
            name=author.name,
            verification_level=author.verification_level,
        ),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


@router.patch("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: UUID,
    update_data: UpdatePostRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PostResponse:
    """Update a post (only draft or needs_info)."""
    post = await post_service.update_post(db, post_id, current_user.id, update_data)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return PostResponse(
        id=post.id,
        title=post.title,
        description=post.description,
        category=post.category,
        urgency=post.urgency,
        city=post.city,
        status=post.status,
        author=AuthorInfo(
            id=current_user.id,
            name=current_user.name,
            verification_level=current_user.verification_level,
        ),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a post."""
    await post_service.delete_post(db, post_id, current_user.id)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None


@limiter.limit("10/hour")
@router.post("/{post_id}/submit", response_model=PostResponse)
async def submit_post(
    request: Request,
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PostResponse:
    """Submit post for verification."""
    post = await post_service.submit_post(db, post_id, current_user.id)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return PostResponse(
        id=post.id,
        title=post.title,
        description=post.description,
        category=post.category,
        urgency=post.urgency,
        city=post.city,
        status=post.status,
        author=AuthorInfo(
            id=current_user.id,
            name=current_user.name,
            verification_level=current_user.verification_level,
        ),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


@router.get("", response_model=FeedResponse)
async def get_my_posts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
) -> FeedResponse:
    """Get current user's posts."""
    posts, total = await post_service.get_my_posts(db, current_user.id, page, per_page)

    items = []
    for post in posts:
        items.append(
            PostSummary(
                id=post.id,
                title=post.title,
                description=post.description[:200] + "..." if len(post.description) > 200 else post.description,
                category=post.category,
                urgency=post.urgency,
                city=post.city,
                status=post.status,
                author=AuthorInfo(
                    id=current_user.id,
                    name=current_user.name,
                    verification_level=current_user.verification_level,
                ),
                created_at=post.created_at,
            )
        )

    return FeedResponse(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        has_next=(page * per_page) < total,
    )
