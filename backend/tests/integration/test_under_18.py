"""Closing accounts made at 13 to 17 after HealAll became 18+."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.security import create_access_token
from app.models.user import User
from app.services import notification_service, under_18_service, upload_service

_counter = iter(range(100, 999))


async def _member(db: AsyncSession, age: str = "13-17", roles: list[str] | None = None, **extra) -> User:
    n = next(_counter)
    user = User(
        name=f"Member {n}",
        phone=f"+91900000{n:04d}",
        email=f"member{n}@example.com",
        city="Pune",
        age_range=age,
        roles=roles or [UserRole.HELP_SEEKER.value],
        **extra,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token(subject=str(user.id), roles=user.roles, verification_level=user.verification_level)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    calls: list[tuple[str, str]] = []

    async def fake_send_email(to: str, subject: str, body: str) -> bool:
        calls.append((to, subject))
        return True

    monkeypatch.setattr(notification_service, "send_email", fake_send_email)
    return calls


@pytest.fixture(autouse=True)
def removed_files(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    calls: list[str] = []

    async def fake_delete_member_files(user_id: str, post_ids: list[str]) -> None:
        calls.append(user_id)

    monkeypatch.setattr(upload_service, "delete_member_files", fake_delete_member_files)
    return calls


@pytest.fixture
async def head_admin(db_session: AsyncSession) -> User:
    return await _member(db_session, age="35-44", roles=[UserRole.HEAD_ADMIN.value])


@pytest.mark.asyncio
async def test_only_head_admins_reach_it(client: AsyncClient, db_session: AsyncSession):
    admin = await _member(db_session, age="25-34", roles=[UserRole.ADMIN.value])
    for method, path in [
        ("get", "/v1/admin/under-18"),
        ("post", "/v1/admin/under-18/warn"),
        ("post", "/v1/admin/under-18/close"),
    ]:
        resp = await client.request(method.upper(), path, headers=_headers(admin))
        assert resp.status_code == 403, path


@pytest.mark.asyncio
async def test_warn_then_close_after_a_week(
    client: AsyncClient,
    db_session: AsyncSession,
    head_admin: User,
    sent: list[tuple[str, str]],
    removed_files: list[str],
):
    teen = await _member(db_session)
    fixed = await _member(db_session)
    adult = await _member(db_session, age="18-24")
    staff = await _member(db_session, roles=[UserRole.MODERATOR.value])

    resp = await client.get("/v1/admin/under-18", headers=_headers(head_admin))
    assert resp.json() == {"total": 3, "not_warned": 2, "waiting": 0, "due": 0, "staff": 1, "next_close_on": None}

    resp = await client.post("/v1/admin/under-18/warn", headers=_headers(head_admin))
    assert resp.status_code == 200
    assert resp.json()["sent"] == 2
    assert sorted(to for to, _ in sent) == sorted([teen.email, fixed.email])
    assert all("will close on" in subject for _, subject in sent)

    # A second press sends nothing more.
    resp = await client.post("/v1/admin/under-18/warn", headers=_headers(head_admin))
    assert resp.json()["sent"] == 0
    assert len(sent) == 2

    # Closing before the week is up closes nothing.
    resp = await client.post("/v1/admin/under-18/close", headers=_headers(head_admin))
    assert resp.json() == {"closed": 0}

    # One member says they're an adult in the meantime.
    resp = await client.patch("/v1/users/me", json={"age_range": "18-24"}, headers=_headers(fixed))
    assert resp.status_code == 200, resp.text

    # Move both warnings back past the week.
    week_ago = datetime.now(UTC) - timedelta(days=9)
    for user_id in (teen.id, fixed.id):
        member = await db_session.get(User, user_id)
        member.under_18_warned_at = week_ago
    await db_session.commit()

    resp = await client.get("/v1/admin/under-18", headers=_headers(head_admin))
    assert resp.json()["due"] == 1

    resp = await client.post("/v1/admin/under-18/close", headers=_headers(head_admin))
    assert resp.json() == {"closed": 1}
    assert removed_files == [str(teen.id)]

    kept = {fixed.id, adult.id, staff.id, head_admin.id}
    closed = teen.id
    db_session.expire_all()
    remaining = set((await db_session.execute(select(User.id))).scalars())
    assert closed not in remaining
    assert kept <= remaining


@pytest.mark.asyncio
async def test_failed_email_is_not_marked_warned(
    client: AsyncClient, db_session: AsyncSession, head_admin: User, monkeypatch: pytest.MonkeyPatch
):
    teen = await _member(db_session)

    async def failing_send(to: str, subject: str, body: str) -> bool:
        return False

    monkeypatch.setattr(notification_service, "send_email", failing_send)
    resp = await client.post("/v1/admin/under-18/warn", headers=_headers(head_admin))
    assert resp.json()["failed"] == 1

    teen_id = teen.id
    db_session.expire_all()
    warned_at = (await db_session.execute(select(User.under_18_warned_at).where(User.id == teen_id))).scalar_one()
    assert warned_at is None


def test_close_on_gives_a_full_week():
    warned = datetime(2026, 11, 28, 18, 0, tzinfo=UTC)  # 23:30 in India
    assert under_18_service.close_on(warned).isoformat() == "2026-12-06"
