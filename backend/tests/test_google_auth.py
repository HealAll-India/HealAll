"""Tests for Google OAuth endpoints."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import VerificationLevel
from app.models.invite import InviteCode
from app.models.user import User

GOOGLE_PAYLOAD = {
    "sub": "google-sub-test-12345",
    "email": "googleuser@gmail.com",
    "name": "Google Test User",
    "email_verified": True,
}

SIGNUP_BODY = {
    "invite_code": "HEAL-GOGL01",
    "id_token": "fake-google-id-token-for-testing",
    "phone": "+919876543210",
    "city": "Mumbai",
    "age_range": "25-34",
    "roles": ["help_seeker"],
}


@pytest.fixture
async def invite(db_session: AsyncSession) -> str:
    """Create a single-use invite code."""
    code = InviteCode(
        code="HEAL-GOGL01",
        created_by=uuid4(),
        max_uses=5,
        use_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        revoked=False,
    )
    db_session.add(code)
    await db_session.commit()
    return "HEAL-GOGL01"


@pytest.fixture
async def second_invite(db_session: AsyncSession) -> str:
    """Create a second invite code for duplicate tests."""
    code = InviteCode(
        code="HEAL-GOGL02",
        created_by=uuid4(),
        max_uses=5,
        use_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        revoked=False,
    )
    db_session.add(code)
    await db_session.commit()
    return "HEAL-GOGL02"


@pytest.fixture
async def otp_user(db_session: AsyncSession) -> User:
    """Create an OTP-registered user (no google_sub) matching GOOGLE_PAYLOAD email."""
    user = User(
        name="OTP User",
        phone="+919111111111",
        email=GOOGLE_PAYLOAD["email"],
        city="Delhi",
        age_range="25-34",
        roles=["help_seeker"],
        email_verified=True,
        phone_verified=True,
        verification_level=VerificationLevel.PHONE_EMAIL_VERIFIED,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture(autouse=True)
def mock_verify_token():
    """Patch google token verification to return a fixed payload."""
    with patch(
        "app.services.google_auth_service.verify_google_token",
        new_callable=AsyncMock,
        return_value=GOOGLE_PAYLOAD,
    ) as mock:
        yield mock


class TestGoogleSignup:
    async def test_creates_user_and_returns_jwt(self, client: AsyncClient, invite: str) -> None:
        """Google signup creates a fully verified user and returns access token."""
        resp = await client.post("/v1/auth/google/signup", json=SIGNUP_BODY)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["access_token"]
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "googleuser@gmail.com"
        assert data["user"]["verification_level"] == VerificationLevel.PHONE_EMAIL_VERIFIED

    async def test_user_is_email_verified(self, client: AsyncClient, invite: str) -> None:
        """Google signup marks email as verified (no OTP needed)."""
        resp = await client.post("/v1/auth/google/signup", json=SIGNUP_BODY)
        assert resp.status_code == 201
        # User is at level 1 — means both phone and email verified
        assert resp.json()["user"]["verification_level"] >= 1

    async def test_duplicate_email_returns_409(
        self, client: AsyncClient, invite: str, second_invite: str
    ) -> None:
        """Second signup attempt with same Google account returns 409."""
        await client.post("/v1/auth/google/signup", json=SIGNUP_BODY)
        body2 = {**SIGNUP_BODY, "invite_code": "HEAL-GOGL02", "phone": "+919000000001"}
        resp = await client.post("/v1/auth/google/signup", json=body2)
        assert resp.status_code == 409

    async def test_duplicate_phone_returns_409(
        self, client: AsyncClient, invite: str, second_invite: str
    ) -> None:
        """Second signup with same phone returns 409."""
        await client.post("/v1/auth/google/signup", json=SIGNUP_BODY)

        # Different Google account but same phone
        with patch(
            "app.services.google_auth_service.verify_google_token",
            new_callable=AsyncMock,
            return_value={**GOOGLE_PAYLOAD, "sub": "different-sub", "email": "other@gmail.com"},
        ):
            body2 = {**SIGNUP_BODY, "invite_code": "HEAL-GOGL02"}
            resp = await client.post("/v1/auth/google/signup", json=body2)
        assert resp.status_code == 409

    async def test_invalid_invite_returns_404(self, client: AsyncClient) -> None:
        """Invalid invite code returns 404."""
        body = {**SIGNUP_BODY, "invite_code": "HEAL-BADXXX"}
        resp = await client.post("/v1/auth/google/signup", json=body)
        assert resp.status_code == 404


class TestGoogleLogin:
    async def test_login_after_google_signup(
        self, client: AsyncClient, invite: str
    ) -> None:
        """Google login works after Google signup."""
        await client.post("/v1/auth/google/signup", json=SIGNUP_BODY)
        resp = await client.post("/v1/auth/google/login", json={"id_token": "fake-google-id-token-for-testing"})
        assert resp.status_code == 200
        assert resp.json()["access_token"]

    async def test_login_links_otp_user(
        self, client: AsyncClient, otp_user: User
    ) -> None:
        """Google login links google_sub to existing OTP-registered user."""
        resp = await client.post("/v1/auth/google/login", json={"id_token": "fake-google-id-token-for-testing"})
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == otp_user.email

    async def test_login_unknown_user_returns_401(self, client: AsyncClient) -> None:
        """Google login for unknown email returns 401."""
        with patch(
            "app.services.google_auth_service.verify_google_token",
            new_callable=AsyncMock,
            return_value={**GOOGLE_PAYLOAD, "email": "nobody@unknown.com", "sub": "unknown-sub"},
        ):
            resp = await client.post("/v1/auth/google/login", json={"id_token": "fake-google-id-token-for-testing"})
        assert resp.status_code == 401
