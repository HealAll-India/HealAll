"""The OTP guess limit must hold across requests.

The shared ``client`` fixture reuses one session and never rolls back, so it
cannot see what production does: ``get_db`` rolls the request's transaction
back whenever the route raises. These tests give every request its own
session with exactly that commit/rollback behaviour.
"""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.constants import OTP_MAX_ATTEMPTS, VerificationLevel
from app.db.session import get_db
from app.main import app
from app.models.user import OTPAttempt, User
from app.services import auth_service

EMAIL = "otp-limit@example.com"


@pytest.fixture
async def prod_like_client(engine) -> AsyncGenerator[AsyncClient, None]:
    """A client whose requests each get a fresh session that rolls back on error."""
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def per_request_db() -> AsyncGenerator[AsyncSession, None]:
        async with maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = per_request_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def member_with_otp(engine) -> str:
    """A verified member with one fresh login OTP; returns the OTP."""
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        session.add(
            User(
                name="Limit Test",
                phone="+919800000001",
                email=EMAIL,
                city="Delhi",
                age_range="25-34",
                roles=["helper"],
                phone_verified=True,
                email_verified=True,
                verification_level=VerificationLevel.PHONE_EMAIL_VERIFIED,
            )
        )
        otp, _ = await auth_service.create_otp(session, EMAIL, purpose="login")
        await session.commit()
    return otp


def _wrong(otp: str) -> str:
    return f"{(int(otp) + 1) % 1_000_000:06d}"


async def _attempts(engine) -> int:
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        row = await session.execute(select(OTPAttempt.attempts).where(OTPAttempt.phone_or_email == EMAIL))
        return row.scalar_one()


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/v1/auth/token", "/v1/auth/verify-otp"])
async def test_wrong_guesses_are_counted(prod_like_client: AsyncClient, member_with_otp: str, engine, path: str):
    for _ in range(2):
        resp = await prod_like_client.post(path, json={"phone_or_email": EMAIL, "otp_code": _wrong(member_with_otp)})
        assert resp.status_code == 422
    assert await _attempts(engine) == 2


@pytest.mark.asyncio
async def test_correct_code_is_refused_after_max_wrong_guesses(
    prod_like_client: AsyncClient, member_with_otp: str, engine
):
    for _ in range(OTP_MAX_ATTEMPTS):
        resp = await prod_like_client.post(
            "/v1/auth/token", json={"phone_or_email": EMAIL, "otp_code": _wrong(member_with_otp)}
        )
        assert resp.status_code == 422

    resp = await prod_like_client.post("/v1/auth/token", json={"phone_or_email": EMAIL, "otp_code": member_with_otp})
    assert resp.status_code == 422
    assert "Maximum OTP attempts" in resp.json()["error"]["message"]
    assert await _attempts(engine) == OTP_MAX_ATTEMPTS


@pytest.mark.asyncio
async def test_correct_code_still_signs_in(prod_like_client: AsyncClient, member_with_otp: str):
    resp = await prod_like_client.post(
        "/v1/auth/token", json={"phone_or_email": EMAIL, "otp_code": _wrong(member_with_otp)}
    )
    assert resp.status_code == 422
    resp = await prod_like_client.post("/v1/auth/token", json={"phone_or_email": EMAIL, "otp_code": member_with_otp})
    assert resp.status_code == 200
    assert resp.json()["access_token"]


@pytest.mark.asyncio
async def test_inactive_member_cannot_sign_in(prod_like_client: AsyncClient, member_with_otp: str, engine):
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        user = (await session.execute(select(User).where(User.email == EMAIL))).scalar_one()
        user.is_active = False
        await session.commit()

    resp = await prod_like_client.post("/v1/auth/token", json={"phone_or_email": EMAIL, "otp_code": member_with_otp})
    assert resp.status_code == 401
    assert "healall_refresh" not in resp.cookies


@pytest.mark.asyncio
async def test_expired_code_is_refused(prod_like_client: AsyncClient, member_with_otp: str, engine):
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        otp = (await session.execute(select(OTPAttempt).where(OTPAttempt.phone_or_email == EMAIL))).scalar_one()
        otp.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        await session.commit()

    resp = await prod_like_client.post("/v1/auth/token", json={"phone_or_email": EMAIL, "otp_code": member_with_otp})
    assert resp.status_code == 410
