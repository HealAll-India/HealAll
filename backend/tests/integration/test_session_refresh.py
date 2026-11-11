"""Members stay signed in: the refresh cookie renews the 15-minute access token."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_token
from app.models.user import RefreshToken, User
from app.services.auth_service import create_otp


@pytest.fixture
async def member(db_session: AsyncSession) -> User:
    user = User(
        name="Priya Sharma",
        phone="+919876543210",
        email="priya@example.com",
        city="Delhi",
        age_range="25-34",
        roles=["helper"],
        phone_verified=True,
        email_verified=True,
        verification_level=1,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _sign_in(client: AsyncClient, db_session: AsyncSession, user: User) -> str:
    """Sign in with a one-time code and return the refresh cookie's value."""
    otp, _ = await create_otp(db_session, user.phone, "login")
    await db_session.commit()
    response = await client.post("/v1/auth/token", json={"phone_or_email": user.phone, "otp_code": otp})
    assert response.status_code == 200, response.text
    cookie = response.cookies.get("healall_refresh")
    assert cookie
    return cookie


async def _refresh(client: AsyncClient, cookie: str | None):
    # The cookie is Secure outside debug mode, so send it explicitly over the test's http URL.
    headers = {"cookie": f"healall_refresh={cookie}"} if cookie else {}
    return await client.post("/v1/auth/refresh", headers=headers)


@pytest.mark.asyncio
async def test_refresh_issues_a_new_access_token(client: AsyncClient, db_session: AsyncSession, member: User):
    cookie = await _sign_in(client, db_session, member)
    response = await _refresh(client, cookie)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["id"] == str(member.id)
    me = await client.get("/v1/users/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200


@pytest.mark.asyncio
async def test_refresh_stores_a_lookup_hash_not_the_token(client: AsyncClient, db_session: AsyncSession, member: User):
    cookie = await _sign_in(client, db_session, member)
    stored = (await db_session.execute(select(RefreshToken.token_hash))).scalars().all()
    assert stored == [hash_token(cookie)]


@pytest.mark.asyncio
async def test_signing_up_sets_the_refresh_cookie_too(client: AsyncClient, db_session: AsyncSession):
    newcomer = User(
        name="Arjun Rao",
        phone="+919876500000",
        email="arjun@example.com",
        city="Pune",
        age_range="25-34",
        roles=["helper"],
        email_verified=True,
    )
    db_session.add(newcomer)
    await db_session.commit()
    otp, _ = await create_otp(db_session, newcomer.phone, "signup")
    await db_session.commit()
    # Verifying the last contact detail signs the member in.
    response = await client.post("/v1/auth/verify-otp", json={"phone_or_email": newcomer.phone, "otp_code": otp})
    assert response.status_code == 200, response.text
    assert response.json()["access_token"]
    assert (await _refresh(client, response.cookies.get("healall_refresh"))).status_code == 200


@pytest.mark.asyncio
async def test_refresh_rejects_missing_unknown_revoked_and_expired(
    client: AsyncClient, db_session: AsyncSession, member: User
):
    assert (await _refresh(client, None)).status_code == 401
    assert (await _refresh(client, "not-a-real-token")).status_code == 401

    cookie = await _sign_in(client, db_session, member)
    await db_session.execute(update(RefreshToken).values(expires_at=datetime.now(UTC) - timedelta(minutes=1)))
    await db_session.commit()
    assert (await _refresh(client, cookie)).status_code == 410

    cookie = await _sign_in(client, db_session, member)
    access = (await _refresh(client, cookie)).json()["access_token"]
    logout = await client.post("/v1/auth/logout", headers={"Authorization": f"Bearer {access}"})
    assert logout.status_code == 200
    assert (await _refresh(client, cookie)).status_code == 401


@pytest.mark.asyncio
async def test_refresh_ends_for_a_deactivated_member(client: AsyncClient, db_session: AsyncSession, member: User):
    cookie = await _sign_in(client, db_session, member)
    member.is_active = False
    await db_session.commit()
    assert (await _refresh(client, cookie)).status_code == 401
