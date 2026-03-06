"""Report schemas."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.report import ReportReason, ReportStatus, ReportTargetType


class CreateReportRequest(BaseModel):
    """Payload to create a moderation report."""

    target_type: ReportTargetType
    target_id: UUID
    reason: ReportReason
    description: str | None = Field(default=None, max_length=4000)


class ReportResponse(BaseModel):
    """Report response payload."""

    id: UUID
    reporter_id: UUID
    target_type: str
    target_id: UUID
    reason: str
    description: str | None = None
    status: str
    created_at: datetime


class ReportListResponse(BaseModel):
    """Paginated report list response."""

    items: list[ReportResponse]
    page: int
    per_page: int
    total: int
    has_next: bool


class UpdateReportStatusRequest(BaseModel):
    """Request to update report moderation status."""

    status: ReportStatus
