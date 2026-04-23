"""Consent-based messaging endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import DuplicateException
from app.db.session import get_db
from app.models.user import User
from app.schemas.message import (
    ConsentRequestResponse,
    ConversationDetailResponse,
    ConversationResponse,
    MessageResponse,
    RequestConsentRequest,
    SendMessageRequest,
)
from app.services import message_service

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post(
    "/request-consent",
    response_model=ConsentRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_consent(
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

    return ConversationResponse(
        id=conversation.id,
        consent_id=conversation.consent_id,
        user_a=conversation.user_a,
        user_b=conversation.user_b,
        ended_at=conversation.ended_at,
        created_at=conversation.created_at,
    )


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
    """List all conversations for the current user."""
    conversations = await message_service.list_conversations(
        db=db,
        current_user=current_user,
    )

    return [
        ConversationResponse(
            id=conversation.id,
            consent_id=conversation.consent_id,
            user_a=conversation.user_a,
            user_b=conversation.user_b,
            ended_at=conversation.ended_at,
            created_at=conversation.created_at,
        )
        for conversation in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
) -> ConversationDetailResponse:
    """Get conversation details with paginated messages."""
    conversation, messages = await message_service.get_conversation_with_messages(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        page=page,
        per_page=per_page,
    )

    return ConversationDetailResponse(
        conversation=ConversationResponse(
            id=conversation.id,
            consent_id=conversation.consent_id,
            user_a=conversation.user_a,
            user_b=conversation.user_b,
            ended_at=conversation.ended_at,
            created_at=conversation.created_at,
        ),
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
async def send_message(
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
