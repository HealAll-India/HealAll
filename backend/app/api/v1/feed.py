"""Feed endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.post import AuthorInfo, FeedResponse, PostSummary
from app.services import post_service

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
async def get_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    city: str | None = None,
    category: str | None = None,
    urgency: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
) -> FeedResponse:
    """Get feed of verified help requests."""
    posts, total = await post_service.get_feed(
        db,
        viewer_id=current_user.id,
        city=city,
        category=category,
        urgency=urgency,
        search=search,
        page=page,
        per_page=per_page,
    )

    # Get all unique author IDs
    author_ids = list({post.author_id for post in posts})

    # Fetch all authors in one query
    authors_result = await db.execute(select(User).where(User.id.in_(author_ids)))
    authors = {author.id: author for author in authors_result.scalars().all()}

    items = []
    for post in posts:
        author = authors.get(post.author_id)
        if author:
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
                        id=author.id,
                        name=author.name,
                        verification_level=author.verification_level,
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
