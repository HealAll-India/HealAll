"""Unauthenticated public read endpoints used by the landing page.

No ``Depends(get_current_user)`` anywhere in this module — that's the
contract that lets logged-out visitors see real activity. Field
stripping is enforced by the response_model pydantic projection
(``schemas.public``) rather than ad-hoc dict trimming.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.public import (
    LandingStatsResponse,
    PublicCommentResponse,
    PublicFeedResponse,
    PublicPostDetail,
)
from app.services import public_service

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/stats", response_model=LandingStatsResponse)
@limiter.limit("120/minute")
async def get_landing_stats(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LandingStatsResponse:
    """Aggregated counts for the landing-page stats card."""
    data = await public_service.get_landing_stats(db)
    return LandingStatsResponse(**data)


@router.get("/posts", response_model=PublicFeedResponse)
@limiter.limit("120/minute")
async def list_public_posts(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    city: str | None = None,
    category: str | None = None,
    urgency: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
) -> PublicFeedResponse:
    """Active posts feed for unauthenticated visitors."""
    data = await public_service.get_public_feed(
        db, page=page, per_page=per_page, city=city, category=category, urgency=urgency
    )
    return PublicFeedResponse(**data)


@router.get("/posts/{post_id}", response_model=PublicPostDetail)
@limiter.limit("120/minute")
async def get_public_post(
    request: Request,
    post_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PublicPostDetail:
    """Single ACTIVE post; RESOLVED posts are private from anonymous viewers."""
    data = await public_service.get_public_post(db, post_id)
    return PublicPostDetail(**data)


@router.get("/posts/{post_id}/comments", response_model=list[PublicCommentResponse])
@limiter.limit("120/minute")
async def list_public_comments(
    request: Request,
    post_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PublicCommentResponse]:
    """Comments on an ACTIVE post; same visibility rule as the post itself."""
    data = await public_service.list_public_comments(db, post_id)
    return [PublicCommentResponse(**c) for c in data]
