"""Schemas for community verification voting."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.post import PostStatus, VoteDecision
from app.schemas.post import AuthorInfo


class CommunityVoteRequest(BaseModel):
    """Cast a community verification vote on a submitted post."""

    decision: VoteDecision
    reason: str | None = Field(None, max_length=500)


class CommunityVoteSummary(BaseModel):
    """Vote tally exposed to clients."""

    approve: int = 0
    reject: int = 0
    needs_info: int = 0
    threshold: int


class CommunityVoteItem(BaseModel):
    """Post entry in the community queue."""

    post_id: UUID
    title: str
    description: str
    category: str
    urgency: str
    city: str
    address: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    author: AuthorInfo
    submitted_at: datetime
    votes: CommunityVoteSummary


class CommunityQueueResponse(BaseModel):
    """Paginated community verification queue."""

    items: list[CommunityVoteItem]
    page: int
    per_page: int
    total: int
    has_next: bool
    threshold: int


class CommunityVoteResult(BaseModel):
    """Result of casting a vote."""

    post_id: UUID
    # Domain enums (not str) so invalid values can't slip through the response
    # contract and clients can switch on a known set.
    decision: VoteDecision
    new_status: PostStatus
    votes: CommunityVoteSummary
    promoted_to_active: bool
