"""Verification queue schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.post import AuthorInfo


class VerificationActionRequest(BaseModel):
    """Payload for verifier decision actions."""

    remarks: str = Field(..., min_length=5, max_length=5000)
    evidence_s3_key: str | None = Field(None, max_length=500)


class VerificationQueueItem(BaseModel):
    """Pending post item visible to verifiers."""

    post_id: UUID
    title: str
    category: str
    urgency: str
    city: str
    author: AuthorInfo
    submitted_at: datetime


class VerificationQueueResponse(BaseModel):
    """Paginated verification queue response."""

    items: list[VerificationQueueItem]
    page: int
    per_page: int
    total: int
    has_next: bool


class VerificationActionResponse(BaseModel):
    """Result of a verification action."""

    post_id: UUID
    decision: str
    new_status: str
    remarks: str
    case_id: UUID | None = None
    actioned_at: datetime
