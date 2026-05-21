"""Pydantic schemas for unauthenticated landing-page reads.

The shape is deliberately narrower than the authenticated payloads in
``schemas/post.py`` / ``schemas/comment.py`` — anonymous visitors must
never see private fields (address, pincode, lat/lng, contact_prefs,
phone, email). The router builds these models field-by-field from the
ORM so adding a new column on ``Post`` does not auto-leak into a public
response.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PublicAuthorInfo(BaseModel):
    """Display-only subset of an author for public surfaces."""

    id: UUID
    name: str
    verification_level: int


class PublicPostSummary(BaseModel):
    """Card-shape post for the landing feed."""

    id: UUID
    title: str
    description: str  # truncated in the service
    category: str
    urgency: str
    city: str
    status: str
    helper_count: int
    author: PublicAuthorInfo
    created_at: datetime


class PublicPostDetail(PublicPostSummary):
    """Full description; same set of fields. Explicit subclass keeps the
    contract obvious for the FastAPI response_model."""


class PublicFeedResponse(BaseModel):
    items: list[PublicPostSummary]
    page: int
    per_page: int
    total: int
    has_next: bool


class PublicCommentAuthor(BaseModel):
    id: UUID
    name: str
    verification_level: int


class PublicCommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    author: PublicCommentAuthor
    body: str
    created_at: datetime


class LandingStatsResponse(BaseModel):
    helped: int
    verified_members: int
    active_cases: int
    cities: int
    generated_at: datetime
