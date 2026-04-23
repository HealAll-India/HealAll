"""Post schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.post import PostCategory, PostUrgency


class CreatePostRequest(BaseModel):
    """Create a new help request post."""

    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=5000)
    category: PostCategory
    urgency: PostUrgency = PostUrgency.NORMAL
    city: str = Field(..., min_length=2, max_length=100)
    contact_prefs: dict[str, bool] | None = None


class UpdatePostRequest(BaseModel):
    """Update a post."""

    title: str | None = Field(None, min_length=5, max_length=200)
    description: str | None = Field(None, min_length=20, max_length=5000)
    category: PostCategory | None = None
    urgency: PostUrgency | None = None
    contact_prefs: dict[str, bool] | None = None


class AuthorInfo(BaseModel):
    """Post author information."""

    id: UUID
    name: str
    verification_level: int


class PostResponse(BaseModel):
    """Post response."""

    id: UUID
    title: str
    description: str
    category: str
    urgency: str
    city: str
    status: str
    author: AuthorInfo
    created_at: datetime
    updated_at: datetime


class PostSummary(BaseModel):
    """Post summary for feed."""

    id: UUID
    title: str
    description: str  # Will be truncated in service layer
    category: str
    urgency: str
    city: str
    status: str
    author: AuthorInfo
    created_at: datetime


class FeedResponse(BaseModel):
    """Feed response with pagination."""

    items: list[PostSummary]
    page: int
    per_page: int
    total: int
    has_next: bool
