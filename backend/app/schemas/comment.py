"""Comment schemas."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreateCommentRequest(BaseModel):
    """Payload for creating a comment."""

    body: str = Field(..., min_length=1, max_length=2000)


class CommentAuthor(BaseModel):
    """Minimal author metadata for comments."""

    id: UUID
    name: str
    verification_level: int


class CommentResponse(BaseModel):
    """Comment response payload."""

    id: UUID
    post_id: UUID
    author: CommentAuthor
    body: str
    created_at: datetime
