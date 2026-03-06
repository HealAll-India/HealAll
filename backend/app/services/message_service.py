"""Services for consent-based direct messaging."""
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateException, ForbiddenException, InvalidStateException, NotFoundException, RateLimitException
from app.models.message import Conversation, DMConsentRequest, DMConsentStatus, Message
from app.models.post import Post
from app.models.user import User
from app.services import user_service

DECLINE_COOLDOWN_DAYS = 7


async def _get_user_or_404(db: AsyncSession, user_id: UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")
    return user


async def _get_post_or_404(db: AsyncSession, post_id: UUID) -> Post:
    result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundException("Post not found")
    return post


async def request_consent(
    db: AsyncSession,
    current_user: User,
    to_user_id: UUID,
    post_id: UUID | None,
) -> DMConsentRequest:
    """Create DM consent request, enforcing block and cooldown rules."""
    if current_user.id == to_user_id:
        raise ForbiddenException("Cannot request DM consent from yourself")

    await _get_user_or_404(db, to_user_id)

    if post_id:
        await _get_post_or_404(db, post_id)

    if await user_service.is_user_blocked(db, current_user.id, to_user_id):
        raise ForbiddenException("Blocked users cannot send consent requests")

    pending_result = await db.execute(
        select(DMConsentRequest).where(
            DMConsentRequest.from_user_id == current_user.id,
            DMConsentRequest.to_user_id == to_user_id,
            DMConsentRequest.post_id == post_id,
            DMConsentRequest.status == DMConsentStatus.PENDING.value,
        )
    )
    pending = pending_result.scalar_one_or_none()
    if pending:
        raise DuplicateException("A consent request is already pending")

    cooldown_threshold = datetime.now(UTC) - timedelta(days=DECLINE_COOLDOWN_DAYS)
    recent_declined_result = await db.execute(
        select(DMConsentRequest).where(
            DMConsentRequest.from_user_id == current_user.id,
            DMConsentRequest.to_user_id == to_user_id,
            DMConsentRequest.post_id == post_id,
            DMConsentRequest.status == DMConsentStatus.DECLINED.value,
            DMConsentRequest.responded_at.is_not(None),
            DMConsentRequest.responded_at >= cooldown_threshold,
        )
    )
    recent_declined = recent_declined_result.scalar_one_or_none()
    if recent_declined:
        raise RateLimitException(
            "Consent was declined recently. Retry after 7 days."
        )

    consent = DMConsentRequest(
        from_user_id=current_user.id,
        to_user_id=to_user_id,
        post_id=post_id,
        status=DMConsentStatus.PENDING.value,
    )
    db.add(consent)
    await db.flush()
    await db.refresh(consent)

    return consent


async def _get_consent_or_404(db: AsyncSession, request_id: UUID) -> DMConsentRequest:
    result = await db.execute(select(DMConsentRequest).where(DMConsentRequest.id == request_id))
    consent = result.scalar_one_or_none()
    if not consent:
        raise NotFoundException("Consent request not found")
    return consent


async def accept_consent(
    db: AsyncSession,
    request_id: UUID,
    current_user: User,
) -> tuple[DMConsentRequest, Conversation]:
    """Accept a pending consent request and open conversation."""
    consent = await _get_consent_or_404(db, request_id)

    if consent.to_user_id != current_user.id:
        raise ForbiddenException("Only the recipient can accept this request")

    if consent.status != DMConsentStatus.PENDING.value:
        raise InvalidStateException("Only pending requests can be accepted")

    if await user_service.is_user_blocked(db, consent.from_user_id, consent.to_user_id):
        raise ForbiddenException("Cannot accept consent due to a block relationship")

    consent.status = DMConsentStatus.ACCEPTED.value
    consent.responded_at = datetime.now(UTC)

    existing_result = await db.execute(
        select(Conversation).where(Conversation.consent_id == consent.id)
    )
    conversation = existing_result.scalar_one_or_none()

    if not conversation:
        conversation = Conversation(
            consent_id=consent.id,
            user_a=consent.from_user_id,
            user_b=consent.to_user_id,
        )
        db.add(conversation)

    await db.flush()
    await db.refresh(consent)
    await db.refresh(conversation)

    return consent, conversation


async def decline_consent(db: AsyncSession, request_id: UUID, current_user: User) -> DMConsentRequest:
    """Decline a pending consent request."""
    consent = await _get_consent_or_404(db, request_id)

    if consent.to_user_id != current_user.id:
        raise ForbiddenException("Only the recipient can decline this request")

    if consent.status != DMConsentStatus.PENDING.value:
        raise InvalidStateException("Only pending requests can be declined")

    consent.status = DMConsentStatus.DECLINED.value
    consent.responded_at = datetime.now(UTC)

    await db.flush()
    await db.refresh(consent)
    return consent


async def list_conversations(db: AsyncSession, current_user: User) -> list[Conversation]:
    """List conversations where current user is a participant."""
    result = await db.execute(
        select(Conversation)
        .where(or_(Conversation.user_a == current_user.id, Conversation.user_b == current_user.id))
        .order_by(Conversation.created_at.desc())
    )
    return list(result.scalars().all())


async def _get_conversation_or_404(db: AsyncSession, conversation_id: UUID) -> Conversation:
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise NotFoundException("Conversation not found")
    return conversation


def _assert_participant(conversation: Conversation, user_id: UUID) -> None:
    if user_id not in {conversation.user_a, conversation.user_b}:
        raise ForbiddenException("You are not part of this conversation")


def _other_participant_id(conversation: Conversation, current_user_id: UUID) -> UUID:
    if conversation.user_a == current_user_id:
        return conversation.user_b
    return conversation.user_a


async def send_message(
    db: AsyncSession,
    conversation_id: UUID,
    current_user: User,
    body: str,
) -> Message:
    """Send a message in an active conversation."""
    conversation = await _get_conversation_or_404(db, conversation_id)
    _assert_participant(conversation, current_user.id)
    other_user_id = _other_participant_id(conversation, current_user.id)

    if await user_service.is_user_blocked(db, current_user.id, other_user_id):
        raise ForbiddenException("Cannot send message due to a block relationship")

    if conversation.ended_at is not None:
        raise InvalidStateException("Conversation has ended")

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        body=body,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def get_conversation_with_messages(
    db: AsyncSession,
    conversation_id: UUID,
    current_user: User,
    page: int,
    per_page: int,
) -> tuple[Conversation, list[Message]]:
    """Return conversation and paginated messages for participants."""
    conversation = await _get_conversation_or_404(db, conversation_id)
    _assert_participant(conversation, current_user.id)
    other_user_id = _other_participant_id(conversation, current_user.id)

    if await user_service.is_user_blocked(db, current_user.id, other_user_id):
        raise ForbiddenException("Cannot access messages due to a block relationship")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    messages = list(result.scalars().all())

    return conversation, messages
