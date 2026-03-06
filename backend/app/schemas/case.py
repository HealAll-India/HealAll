"""Case lifecycle schemas."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class CaseResolutionType(str, Enum):
    """Supported closure reason types."""

    RESOLVED = "resolved"
    STALE = "stale"
    INVALID = "invalid"
    WITHDRAWN = "withdrawn"


class CasePostInfo(BaseModel):
    """Post metadata attached to a case response."""

    id: UUID
    title: str
    category: str
    urgency: str
    city: str
    author_id: UUID


class CaseOwnerInfo(BaseModel):
    """Owner details for a case."""

    id: UUID
    name: str
    verification_level: int


class CaseResponse(BaseModel):
    """Case details."""

    id: UUID
    post: CasePostInfo
    owner: CaseOwnerInfo | None
    status: str
    helper_count: int
    closure_requested_by: UUID | None = None
    closure_requested_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CaseListResponse(BaseModel):
    """Paginated case listing."""

    items: list[CaseResponse]
    page: int
    per_page: int
    total: int
    has_next: bool


class UpdateCaseRequest(BaseModel):
    """Update case metadata."""

    owner_id: UUID | None = None


class CaseHelperResponse(BaseModel):
    """Helper membership response."""

    id: UUID
    case_id: UUID
    user_id: UUID
    status: str
    offered_at: datetime
    withdrawn_at: datetime | None = None


class AddCaseNoteRequest(BaseModel):
    """Payload for adding a case note."""

    body: str = Field(..., min_length=2, max_length=4000)
    support_type: str | None = Field(None, max_length=50)
    hours_contributed: float | None = Field(None, ge=0)
    attachment_s3_key: str | None = Field(None, max_length=500)


class CaseNoteAuthor(BaseModel):
    """Case note author info."""

    id: UUID
    name: str
    verification_level: int


class CaseNoteResponse(BaseModel):
    """Case note response."""

    id: UUID
    case_id: UUID
    author: CaseNoteAuthor
    body: str
    support_type: str | None = None
    hours_contributed: float | None = None
    attachment_s3_key: str | None = None
    created_at: datetime


class CloseCaseRequest(BaseModel):
    """Payload for closing/requesting closure of a case."""

    closure_remarks: str = Field(..., min_length=5, max_length=4000)
    resolution_type: CaseResolutionType
    impact_story: str | None = Field(None, max_length=5000)
    impact_consent: bool = False


class CaseClosureResponse(BaseModel):
    """Case closure record response."""

    id: UUID
    case_id: UUID
    closed_by: UUID
    confirmed_by: UUID | None = None
    resolution_type: str
    remarks: str
    impact_story: str | None = None
    impact_consent: bool
    created_at: datetime
