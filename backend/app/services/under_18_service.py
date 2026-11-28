"""Close accounts made at 13 to 17, now that HealAll is 18+.

Sign-up has refused 13 to 17 since Nov 27, 2026, but members who joined
before then can still sign in. A head admin sends each of them one warning
email, then closes the accounts that still say 13 to 17 once a full week has
passed. A member who is 18 or over can change their age range on their
profile in that week, and then nothing happens to their account.

Staff accounts are left out: ``user_service.delete_account`` refuses them, so
a head admin removes the staff role first.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AgeRange, UserRole
from app.models.user import User
from app.services import notification_service, upload_service, user_service
from app.services.email_templates import under_18_notice_email

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
NOTICE_DAYS = 7
_STAFF = [UserRole.MODERATOR.value, UserRole.ADMIN.value, UserRole.HEAD_ADMIN.value]


def close_on(warned_at: datetime) -> date:
    """The first day, in India, that a member warned at ``warned_at`` can be closed.

    A full ``NOTICE_DAYS`` after the warning, rounded up to the next day.
    """
    return (warned_at.astimezone(IST) + timedelta(days=NOTICE_DAYS)).date() + timedelta(days=1)


def _under_18() -> Select[tuple[User]]:
    return select(User).where(User.age_range == AgeRange.TEEN.value, User.deleted_at.is_(None))


def _is_staff(user: User) -> bool:
    return bool(set(_STAFF).intersection(user.roles or []))


@dataclass
class Summary:
    total: int = 0
    not_warned: int = 0
    waiting: int = 0
    due: int = 0
    staff: int = 0
    next_close_on: date | None = None


@dataclass
class WarnResult:
    sent: int = 0
    failed: int = 0
    close_on: date | None = None


@dataclass
class CloseResult:
    closed: int = 0
    files: list[tuple[UUID, list[UUID]]] = field(default_factory=list)


async def summary(db: AsyncSession, now: datetime | None = None) -> Summary:
    """Counts only, so the admin page shows no member's details."""
    today = (now or datetime.now(UTC)).astimezone(IST).date()
    result = Summary()
    for user in (await db.execute(_under_18())).scalars():
        result.total += 1
        if _is_staff(user):
            result.staff += 1
        elif user.under_18_warned_at is None:
            result.not_warned += 1
        elif close_on(user.under_18_warned_at) <= today:
            result.due += 1
        else:
            result.waiting += 1
            day = close_on(user.under_18_warned_at)
            result.next_close_on = min(result.next_close_on or day, day)
    return result


# Emails go out inside the request, so one press sends at most this many and
# the admin page shows how many are left for the next press.
WARN_BATCH = 40


async def send_warnings(db: AsyncSession, now: datetime | None = None) -> WarnResult:
    """Email up to ``WARN_BATCH`` members still on 13 to 17 who haven't been warned.

    A member is marked warned only when the email provider accepted the
    email, so a failed send is retried by the next press.
    """
    now = now or datetime.now(UTC)
    day = close_on(now)
    result = WarnResult(close_on=day)
    users = (
        (await db.execute(_under_18().where(User.under_18_warned_at.is_(None)).order_by(User.created_at)))
        .scalars()
        .all()
    )
    for user in [u for u in users if not _is_staff(u)][:WARN_BATCH]:
        subject, body = under_18_notice_email(user.name, day)
        try:
            sent = await notification_service.send_email(user.email, subject, body)
        except Exception:
            logger.exception("Under-18 notice failed for user %s", user.id)
            sent = False
        if sent:
            user.under_18_warned_at = now
            result.sent += 1
        else:
            result.failed += 1
    await db.flush()
    return result


async def close_due(db: AsyncSession, now: datetime | None = None) -> CloseResult:
    """Delete the accounts whose week has passed and that still say 13 to 17.

    Returns each closed member's post ids so the caller can remove their
    files once the deletes are committed.
    """
    today = (now or datetime.now(UTC)).astimezone(IST).date()
    result = CloseResult()
    users = (await db.execute(_under_18().where(User.under_18_warned_at.is_not(None)))).scalars().all()
    due = [u.id for u in users if not _is_staff(u) and close_on(u.under_18_warned_at) <= today]
    for user_id in due:
        post_ids = await user_service.delete_account(db, user_id)
        result.files.append((user_id, post_ids))
        result.closed += 1
    return result


async def remove_files(closed: list[tuple[UUID, list[UUID]]]) -> None:
    """Remove the uploads of every closed account, after the deletes commit."""
    for user_id, post_ids in closed:
        await upload_service.delete_member_files(str(user_id), [str(post_id) for post_id in post_ids])
