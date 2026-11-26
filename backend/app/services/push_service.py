"""Web push: save subscriptions and notify members about activity that concerns them.

Push is off, and every send a no-op, until both VAPID keys are configured
(``Settings.push_enabled``).

Privacy: phones are shared and lock screens are public, so a notification
never carries message, comment or post text. It names the other member by
first name at most and links to a same-site path; the page behind it still
checks who is signed in.

Sends run after the response (``app.core.after_response``), so
``notify_user`` opens its own database session and never raises.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import async_session_maker
from app.models.case import Case
from app.models.message import Conversation
from app.models.post import Post
from app.models.privacy import UserBlock
from app.models.push import USER_AGENT_MAX_LENGTH, PushSubscription
from app.models.user import User

logger = logging.getLogger(__name__)

# How long a push service keeps an undelivered notification (phone off, no signal).
PUSH_TTL_SECONDS = 24 * 60 * 60
# Per push-service request. Sends to one member's devices run in parallel, and
# on Lambda the whole after_response call is capped at 10 s.
SEND_TIMEOUT_SECONDS = 5.0
# A member's newest devices; older ones are dropped when another subscribes.
MAX_SUBSCRIPTIONS_PER_USER = 10
TITLE_MAX_LENGTH = 60
BODY_MAX_LENGTH = 120
FIRST_NAME_MAX_LENGTH = 30


def push_enabled() -> bool:
    """True when both VAPID keys are set."""
    return get_settings().push_enabled


# ---------------------------------------------------------------------------
# Subscriptions (request-scoped: flush, the route commits)
# ---------------------------------------------------------------------------


async def save_subscription(
    db: AsyncSession,
    user: User,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str | None,
) -> None:
    """Upsert this device's subscription for ``user``.

    An endpoint saved for another member moves to ``user``: a shared phone
    should only notify whoever turned notifications on last.
    """
    agent = (user_agent or "").strip()[:USER_AGENT_MAX_LENGTH] or None
    values = {"user_id": user.id, "p256dh": p256dh, "auth": auth, "user_agent": agent}
    stmt = insert(PushSubscription).values(endpoint=endpoint, **values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[PushSubscription.endpoint],
        # Restarts the row's age, so the newest-devices cap counts this one as new.
        set_={**values, "created_at": func.now(), "last_success_at": None},
    )
    await db.execute(stmt)

    # Keep only the newest devices, so one account can't pile up endpoints.
    stale = (
        select(PushSubscription.id)
        .where(PushSubscription.user_id == user.id)
        .order_by(PushSubscription.created_at.desc(), PushSubscription.id.desc())
        .offset(MAX_SUBSCRIPTIONS_PER_USER)
    )
    await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(stale)))
    await db.flush()


async def delete_subscription(db: AsyncSession, user: User, endpoint: str) -> None:
    """Delete ``user``'s subscription for ``endpoint``. Another member's row is left alone."""
    await db.execute(
        delete(PushSubscription).where(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user.id)
    )
    await db.flush()


# ---------------------------------------------------------------------------
# Who to notify (request-scoped, read-only)
# ---------------------------------------------------------------------------


async def recipients(db: AsyncSession, actor_id: UUID, candidate_ids: list[UUID | None]) -> list[UUID]:
    """The candidates to notify about ``actor_id``'s action.

    Never the actor themself, and nobody on either side of a block with them.
    Empty while push is off, so no query runs.
    """
    if not push_enabled():
        return []
    wanted = list(dict.fromkeys(uid for uid in candidate_ids if uid is not None and uid != actor_id))
    if not wanted:
        return []
    blocks = await db.execute(
        select(UserBlock.blocker_id, UserBlock.blocked_id).where(
            or_(
                and_(UserBlock.blocker_id == actor_id, UserBlock.blocked_id.in_(wanted)),
                and_(UserBlock.blocked_id == actor_id, UserBlock.blocker_id.in_(wanted)),
            )
        )
    )
    blocked = {blocked_id if blocker_id == actor_id else blocker_id for blocker_id, blocked_id in blocks.all()}
    return [uid for uid in wanted if uid not in blocked]


async def conversation_partner_id(db: AsyncSession, conversation_id: UUID, member_id: UUID) -> UUID | None:
    """The other member of a conversation."""
    if not push_enabled():  # skip the query: nobody will be notified
        return None
    result = await db.execute(
        select(Conversation.user_a, Conversation.user_b).where(Conversation.id == conversation_id)
    )
    row = result.one_or_none()
    if row is None:
        return None
    return row.user_b if row.user_a == member_id else row.user_a


async def post_author_id(db: AsyncSession, post_id: UUID) -> UUID | None:
    """The author of a post."""
    if not push_enabled():  # skip the query: nobody will be notified
        return None
    result = await db.execute(select(Post.author_id).where(Post.id == post_id))
    return result.scalar_one_or_none()


async def case_team_ids(db: AsyncSession, case_id: UUID) -> list[UUID | None]:
    """Who hears about a new help offer: the post's author and the case owner."""
    if not push_enabled():  # skip the query: nobody will be notified
        return []
    result = await db.execute(
        select(Post.author_id, Case.owner_id).join(Post, Case.post_id == Post.id).where(Case.id == case_id)
    )
    row = result.one_or_none()
    return [] if row is None else [row.author_id, row.owner_id]


# ---------------------------------------------------------------------------
# What a notification says. Never message, comment or post text.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Notice:
    """One notification: short, content-free, linking to a same-site path."""

    title: str
    body: str
    url: str
    tag: str


def first_name(user: User) -> str:
    """The member's first name, or a neutral word when there is none."""
    parts = (user.name or "").split()
    return parts[0][:FIRST_NAME_MAX_LENGTH] if parts else "Someone"


def new_message(sender: User, conversation_id: UUID) -> Notice:
    return Notice(
        title="New message",
        body=f"{first_name(sender)} sent you a message",
        url=f"/messages/{conversation_id}",
        tag=f"conversation-{conversation_id}",
    )


def new_message_request(sender: User, consent_id: UUID) -> Notice:
    return Notice(
        title="New message request",
        body=f"{first_name(sender)} would like to message you",
        url="/messages",
        tag=f"consent-{consent_id}",
    )


def message_request_accepted(accepter: User, conversation_id: UUID) -> Notice:
    return Notice(
        title="Message request accepted",
        body=f"{first_name(accepter)} accepted your message request",
        url=f"/messages/{conversation_id}",
        tag=f"conversation-{conversation_id}",
    )


def new_comment(commenter: User, post_id: UUID) -> Notice:
    return Notice(
        title="New comment",
        body=f"{first_name(commenter)} commented on your post",
        url=f"/posts/{post_id}",
        tag=f"comments-{post_id}",
    )


def help_offered(helper: User, case_id: UUID) -> Notice:
    return Notice(
        title="Someone offered to help",
        body=f"{first_name(helper)} offered to help with your case",
        url=f"/cases/{case_id}",
        tag=f"helpers-{case_id}",
    )


# ---------------------------------------------------------------------------
# Sending (after the response, own session, never raises)
# ---------------------------------------------------------------------------


class _Outcome(Enum):
    DELIVERED = "delivered"
    GONE = "gone"
    FAILED = "failed"


def _webpush(**kwargs: Any) -> None:
    """``pywebpush.webpush``, imported on first use: it loads aiohttp, which
    would otherwise slow every Lambda cold start."""
    from pywebpush import webpush

    webpush(**kwargs)


def _deliver(endpoint: str, p256dh: str, auth: str, payload: str) -> _Outcome:
    """Encrypt and post one notification (blocking). Logs no payload or endpoint."""
    from pywebpush import WebPushException

    settings = get_settings()
    try:
        _webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            # A fresh dict per send: webpush writes aud/exp into it.
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=PUSH_TTL_SECONDS,
            timeout=SEND_TIMEOUT_SECONDS,
            headers={"Urgency": "normal"},
        )
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            return _Outcome.GONE
        logger.warning("push: push service refused a notification (status %s)", status)
        return _Outcome.FAILED
    except Exception as exc:  # network errors, a malformed key: never fail the caller
        logger.warning("push: sending a notification failed (%s)", type(exc).__name__)
        return _Outcome.FAILED
    return _Outcome.DELIVERED


def _payload(title: str, body: str, url: str, tag: str) -> str:
    # Only same-site paths: the service worker refuses anything else too.
    safe_url = url if url.startswith("/") and not url.startswith("//") and "\\" not in url else "/"
    return json.dumps(
        {"title": title[:TITLE_MAX_LENGTH], "body": body[:BODY_MAX_LENGTH], "url": safe_url, "tag": tag},
        separators=(",", ":"),
    )


async def notify_users(user_ids: list[UUID], title: str, body: str, url: str, tag: str) -> None:
    """``notify_user`` for several members at once, in parallel, so a route
    that runs sends inline (on Lambda) waits for the slowest, not the sum."""
    await asyncio.gather(*(notify_user(uid, title, body, url, tag) for uid in user_ids))


async def notify_user(user_id: UUID, title: str, body: str, url: str, tag: str) -> None:
    """Send a notification to every device ``user_id`` subscribed.

    Runs after the response in its own session and transaction (the
    request's is closed by then), which records the bookkeeping:
    subscriptions the push service says are gone (404/410) are deleted,
    delivered ones get last_success_at. Never raises.
    """
    if not push_enabled():
        return
    try:
        payload = _payload(title, body, url, tag)
        async with async_session_maker.begin() as db:  # commits the bookkeeping on exit
            result = await db.execute(
                select(PushSubscription.id, PushSubscription.endpoint, PushSubscription.p256dh, PushSubscription.auth)
                .join(User, User.id == PushSubscription.user_id)
                .where(
                    PushSubscription.user_id == user_id,
                    User.is_active.is_(True),
                    User.deleted_at.is_(None),
                )
            )
            subscriptions = result.all()
            if not subscriptions:
                return

            outcomes = await asyncio.gather(
                *(asyncio.to_thread(_deliver, sub.endpoint, sub.p256dh, sub.auth, payload) for sub in subscriptions)
            )
            gone = [sub.id for sub, outcome in zip(subscriptions, outcomes, strict=True) if outcome is _Outcome.GONE]
            delivered = [
                sub.id for sub, outcome in zip(subscriptions, outcomes, strict=True) if outcome is _Outcome.DELIVERED
            ]
            if gone:
                await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(gone)))
            if delivered:
                await db.execute(
                    update(PushSubscription)
                    .where(PushSubscription.id.in_(delivered))
                    .values(last_success_at=datetime.now(UTC))
                )
    except Exception as exc:
        logger.warning("push: notifying a member failed (%s)", type(exc).__name__)
