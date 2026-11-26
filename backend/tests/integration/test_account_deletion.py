"""Integration tests for DELETE /v1/users/me (account deletion).

Google Play requires an in-app path to delete an account and its data.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import OTPAttempt, RefreshToken, User
from app.services import upload_service
from tests.integration.test_users import _create_invite, _signup_and_login

PHONE = "+919822000101"
EMAIL = "deleteme@example.com"


@pytest.fixture(autouse=True)
def removed_files(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, list[str]]]:
    """Record file cleanup calls instead of talking to S3."""
    calls: list[tuple[str, list[str]]] = []

    async def fake_delete_member_files(user_id: str, post_ids: list[str]) -> None:
        calls.append((user_id, post_ids))

    monkeypatch.setattr(upload_service, "delete_member_files", fake_delete_member_files)
    return calls


@pytest.fixture
async def member(client: AsyncClient, db_session: AsyncSession) -> tuple[dict[str, str], str]:
    invite = await _create_invite(db_session, "DELETE-INVITE-001")
    token, user_id = await _signup_and_login(client, db_session, invite.code, phone=PHONE, email=EMAIL)
    return {"Authorization": f"Bearer {token}"}, user_id


@pytest.mark.asyncio
async def test_delete_account_removes_user_and_tokens(
    client: AsyncClient,
    db_session: AsyncSession,
    member: tuple[dict[str, str], str],
    removed_files: list[tuple[str, list[str]]],
):
    headers, user_id = member
    resp = await client.post("/v1/users/me/skills", json={"skill": "Cooking"}, headers=headers)
    assert resp.status_code == 201

    resp = await client.delete("/v1/users/me", headers=headers)
    assert resp.status_code == 204

    db_session.expire_all()
    assert (await db_session.execute(select(User).where(User.id == user_id))).scalar_one_or_none() is None
    tokens = (await db_session.execute(select(RefreshToken).where(RefreshToken.user_id == user_id))).scalars().all()
    assert tokens == []
    otps = (
        (await db_session.execute(select(OTPAttempt).where(OTPAttempt.phone_or_email.in_([PHONE, EMAIL]))))
        .scalars()
        .all()
    )
    assert otps == []

    # Their uploads are queued for removal.
    assert removed_files == [(user_id, [])]

    # The old access token no longer works.
    resp = await client.get("/v1/users/me", headers=headers)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_frees_email_and_phone_for_signup(
    client: AsyncClient, db_session: AsyncSession, member: tuple[dict[str, str], str]
):
    headers, _ = member
    assert (await client.delete("/v1/users/me", headers=headers)).status_code == 204

    invite = await _create_invite(db_session, "DELETE-INVITE-002")
    await _signup_and_login(client, db_session, invite.code, phone=PHONE, email=EMAIL)


@pytest.mark.asyncio
async def test_delete_account_unauthenticated(client: AsyncClient):
    resp = await client.delete("/v1/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_staff_cannot_delete_own_account(
    client: AsyncClient,
    db_session: AsyncSession,
    member: tuple[dict[str, str], str],
    removed_files: list[tuple[str, list[str]]],
):
    headers, user_id = member
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    user.roles = [*user.roles, "moderator"]
    await db_session.commit()

    resp = await client.delete("/v1/users/me", headers=headers)
    assert resp.status_code == 403
    assert removed_files == []

    db_session.expire_all()
    assert (await db_session.execute(select(User).where(User.id == user_id))).scalar_one_or_none() is not None
