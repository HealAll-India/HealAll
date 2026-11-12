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


class ConversationMember(BaseModel):
    """The other participant, as the signed-in member sees them."""

    id: UUID
    name: str
    avatar_url: str | None = None


class LastMessage(BaseModel):
    """The latest message in a conversation, shortened for a list preview."""

    body: str
    sender_id: UUID
    created_at: datetime


class ConversationResponse(BaseModel):
    """Conversation summary response."""

    id: UUID
    consent_id: UUID
    user_a: UUID
    user_b: UUID
    ended_at: datetime | None = None
    created_at: datetime
    other_member: ConversationMember | None = None
    # None when there are no messages yet, or when either member has blocked
    # the other (the thread itself is refused then, so no preview either).
    last_message: LastMessage | None = None
    # Either member has blocked the other: opening the thread is refused (403),
    # which already tells both members as much, so clients show it as unavailable.
    blocked: bool = False


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
    """Conversation detail with messages.

    Page 1 holds the newest messages; later pages go back in time. Each page
    is in chronological order. `has_more` says whether an older page exists.
    """

    conversation: ConversationResponse
    messages: list[MessageResponse]
    has_more: bool = False
