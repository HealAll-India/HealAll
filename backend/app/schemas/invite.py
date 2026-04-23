"""Invite code schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreateInviteRequest(BaseModel):
    """Create invite code request."""

    max_uses: int = Field(default=1, ge=1, le=1000)
    expires_in_days: int = Field(default=30, ge=1, le=365)


class InviteCodeResponse(BaseModel):
    """Invite code response."""

    id: UUID
    code: str
    max_uses: int
    use_count: int
    expires_at: datetime
    created_at: datetime
    is_available: bool
