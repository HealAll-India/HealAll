"""Consent-based messaging endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import DuplicateException
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.message import Conversation
from app.models.user import User
from app.schemas.message import (
    ConsentRequestResponse,
    ConversationDetailResponse,
    ConversationMember,
    ConversationResponse,
    LastMessage,
    MessageResponse,
    RequestConsentRequest,
    SendMessageRequest,
)
from app.services import message_service

router = APIRouter(prefix="/messages", tags=["messages"])


def _conversation_response(
    conversation: Conversation,
    other_member: ConversationMember | None = None,
    last_message: LastMessage | None = None,
) -> ConversationResponse:
    return ConversationResponse(
        id=conversation.id,
        consent_id=conversation.consent_id,
        user_a=conversation.user_a,
        user_b=conversation.user_b,
        ended_at=conversation.ended_at,
        created_at=conversation.created_at,
        other_member=other_member,
        last_message=last_message,
    )


@router.post(
    "/request-consent",
    response_model=ConsentRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/hour")
async def request_consent(
    request: Request,
    payload: RequestConsentRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentRequestResponse:
    """Create a consent request before opening a DM thread."""
    consent = await message_service.request_consent(
        db=db,
        current_user=current_user,
        to_user_id=payload.to_user_id,
        post_id=payload.post_id,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return ConsentRequestResponse(
        id=consent.id,
        from_user_id=consent.from_user_id,
        to_user_id=consent.to_user_id,
        post_id=consent.post_id,
        status=consent.status,
        responded_at=consent.responded_at,
        created_at=consent.created_at,
    )


@router.post("/consent/{request_id}/accept", response_model=ConversationResponse)
async def accept_consent(
    request_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConversationResponse:
    """Accept incoming consent request and open conversation."""
    _consent, conversation = await message_service.accept_consent(
        db=db,
        request_id=request_id,
        current_user=current_user,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return _conversation_response(conversation)


@router.post("/consent/{request_id}/decline", response_model=ConsentRequestResponse)
async def decline_consent(
    request_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentRequestResponse:
    """Decline incoming consent request."""
    consent = await message_service.decline_consent(
        db=db,
        request_id=request_id,
        current_user=current_user,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return ConsentRequestResponse(
        id=consent.id,
        from_user_id=consent.from_user_id,
        to_user_id=consent.to_user_id,
        post_id=consent.post_id,
        status=consent.status,
        responded_at=consent.responded_at,
        created_at=consent.created_at,
    )


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ConversationResponse]:
    """List the current user's conversations, most recent activity first.

    Each names the other member and previews the latest message, except
    across a block, where the thread itself is refused.
    """
    summaries = await message_service.list_conversations(
        db=db,
        current_user=current_user,
    )

    return [
        _conversation_response(
            summary.conversation,
            other_member=ConversationMember(
                id=summary.other_member_id,
                name=summary.other_member_name,
                avatar_url=summary.other_member_avatar_url,
            ),
            last_message=(
                LastMessage(
                    body=message_service.preview(summary.last_message.body),
                    sender_id=summary.last_message.sender_id,
                    created_at=summary.last_message.created_at,
                )
                if summary.last_message
                else None
            ),
        )
        for summary in summaries
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
) -> ConversationDetailResponse:
    """Get a conversation with one page of messages: page 1 is the newest."""
    conversation, other, messages, has_more = await message_service.get_conversation_with_messages(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        page=page,
        per_page=per_page,
    )
    other_id = conversation.user_b if conversation.user_a == current_user.id else conversation.user_a

    return ConversationDetailResponse(
        conversation=_conversation_response(
            conversation,
            other_member=ConversationMember(
                id=other_id,
                name=other.name if other else message_service.FORMER_MEMBER_NAME,
                avatar_url=other.avatar_url if other else None,
            ),
        ),
        has_more=has_more,
        messages=[
            MessageResponse(
                id=message.id,
                conversation_id=message.conversation_id,
                sender_id=message.sender_id,
                body=message.body,
                read_at=message.read_at,
                created_at=message.created_at,
            )
            for message in messages
        ],
    )


@router.post("/conversations/{conversation_id}", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def send_message(
    request: Request,
    conversation_id: UUID,
    payload: SendMessageRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Send a message in a conversation."""
    message = await message_service.send_message(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        body=payload.body,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        body=message.body,
        read_at=message.read_at,
        created_at=message.created_at,
    )
