"""Moderation action schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.report import ModerationActionType


class CreateModerationActionRequest(BaseModel):
    """Payload for creating moderation action."""

    report_id: UUID | None = None
    target_user_id: UUID | None = None
    action: ModerationActionType
    reason: str = Field(..., min_length=3, max_length=4000)
    duration_hours: int | None = Field(default=None, ge=1, le=24 * 365)

    @model_validator(mode="after")
    def validate_target(self):
        if not self.report_id and not self.target_user_id:
            raise ValueError("Either report_id or target_user_id must be provided")
        return self


class ModerationActionResponse(BaseModel):
    """Moderation action response payload."""

    id: UUID
    report_id: UUID | None = None
    target_user_id: UUID
    acted_by: UUID
    action: str
    reason: str
    duration_hours: int | None = None
    expires_at: datetime | None = None
    created_at: datetime


class ModerationActionListResponse(BaseModel):
    """Paginated list response for moderation actions."""

    items: list[ModerationActionResponse]
    page: int
    per_page: int
    total: int
    has_next: bool
