"""Consent-based messaging schemas."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class RequestConsentRequest(BaseModel):
    """Payload to initiate a DM consent request."""

    to_user_id: UUID
    post_id: UUID | None = None


class ConsentRequestResponse(BaseModel):
    """Consent request response."""

    id: UUID
    from_user_id: UUID
    to_user_id: UUID
    post_id: UUID | None = None
    status: str
    responded_at: datetime | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    """Conversation summary response."""

    id: UUID
    consent_id: UUID
    user_a: UUID
    user_b: UUID
    ended_at: datetime | None = None
    created_at: datetime


class SendMessageRequest(BaseModel):
    """Payload for sending a message."""

    body: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    """Message response payload."""

    id: UUID
    conversation_id: UUID
    sender_id: UUID
    body: str
    read_at: datetime | None = None
    created_at: datetime


class ConversationDetailResponse(BaseModel):
    """Conversation detail with messages."""

    conversation: ConversationResponse
    messages: list[MessageResponse]
