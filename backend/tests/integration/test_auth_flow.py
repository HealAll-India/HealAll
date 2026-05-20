"""Integration tests for the complete auth flow."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole, VerificationLevel
from app.models.invite import InviteCode
from app.models.user import User


@pytest.fixture
async def invite_code(db_session: AsyncSession) -> InviteCode:
    """Create a test invite code."""
    from uuid import uuid4

    invite = InviteCode(
        code="TEST-INVITE-123",
        created_by=uuid4(),
        max_uses=5,
        use_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        revoked=False,
    )
    db_session.add(invite)
    await db_session.commit()
    await db_session.refresh(invite)
    return invite


@pytest.mark.asyncio
async def test_complete_auth_flow(
    client: AsyncClient,
    invite_code: InviteCode,
    db_session: AsyncSession,
):
    """Test the complete authentication flow: signup -> verify -> login."""

    # Step 1: Signup
    signup_data = {
        "name": "Test User",
        "phone": "+919876543210",
        "email": "test@example.com",
        "city": "Mumbai",
        "age_range": "18-24",
        "invite_code": invite_code.code,
        "roles": ["helper", "help_seeker"],
    }

    response = await client.post("/v1/auth/signup", json=signup_data)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "Test User"
    assert data["verification_level"] == VerificationLevel.UNVERIFIED
    # Phone is auto-verified at signup (SMS OTP bypassed, coming soon)
    assert "phone" not in data["pending_verification"]
    assert "email" in data["pending_verification"]
    user_id = data["id"]

    from app.services.auth_service import create_otp

    # Step 2: Verify email OTP (phone auto-verified at signup)
    email_otp_plain, _ = await create_otp(
        db_session,
        signup_data["email"],
        "signup",
    )

    verify_email_data = {
        "phone_or_email": signup_data["email"],
        "otp_code": email_otp_plain,
    }

    response = await client.post("/v1/auth/verify-otp", json=verify_email_data)
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is True
    assert data["verification_level"] == VerificationLevel.PHONE_EMAIL_VERIFIED

    # Step 5: Login
    login_otp_plain, _ = await create_otp(
        db_session,
        signup_data["phone"],
        "login",
    )

    login_data = {
        "phone_or_email": signup_data["phone"],
        "otp_code": login_otp_plain,
    }

    response = await client.post("/v1/auth/token", json=login_data)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["id"] == user_id
    assert data["user"]["name"] == "Test User"
    assert UserRole.HELPER.value in data["user"]["roles"]
    assert UserRole.HELP_SEEKER.value in data["user"]["roles"]

    access_token = data["access_token"]

    # Step 6: Test authenticated endpoint (logout)
    response = await client.post("/v1/auth/logout", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert "message" in response.json()


@pytest.mark.asyncio
async def test_signup_with_invalid_invite(client: AsyncClient):
    """Test signup with an invalid invite code."""
    signup_data = {
        "name": "Test User",
        "phone": "+919876543211",
        "email": "test2@example.com",
        "city": "Mumbai",
        "age_range": "18-24",
        "invite_code": "INVALID-CODE",
        "roles": ["helper"],
    }

    response = await client.post("/v1/auth/signup", json=signup_data)
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_signup_with_duplicate_phone(client: AsyncClient, invite_code: InviteCode, db_session: AsyncSession):
    """Test signup with a phone number that already exists."""
    # Create existing user
    existing_user = User(
        name="Existing User",
        phone="+919999999998",
        email="existing@example.com",
        city="Delhi",
        age_range="25-34",
        roles=["helper"],
    )
    db_session.add(existing_user)
    await db_session.commit()

    # Try to sign up with same phone
    signup_data = {
        "name": "New User",
        "phone": "+919999999998",
        "email": "new@example.com",
        "city": "Mumbai",
        "age_range": "18-24",
        "invite_code": invite_code.code,
        "roles": ["helper"],
    }

    response = await client.post("/v1/auth/signup", json=signup_data)
    assert response.status_code == 409
    data = response.json()
    assert data["error"]["code"] == "DUPLICATE"
    assert "phone" in data["error"]["message"].lower()


@pytest.mark.asyncio
async def test_signup_with_existing_email_sends_login_otp(
    client: AsyncClient,
    invite_code: InviteCode,
    db_session: AsyncSession,
):
    """Existing email on signup gets an OTP login path instead of a duplicate dead end."""
    existing_user = User(
        name="Existing User",
        phone="+919999999997",
        email="existing@example.com",
        city="Delhi",
        age_range="25-34",
        roles=["helper"],
        email_verified=True,
        phone_verified=True,
        verification_level=VerificationLevel.PHONE_EMAIL_VERIFIED,
    )
    db_session.add(existing_user)
    await db_session.commit()

    signup_data = {
        "name": "New User",
        "phone": "+919999999996",
        "email": existing_user.email,
        "city": "Mumbai",
        "age_range": "18-24",
        "invite_code": "NOT-NEEDED",
        "roles": ["helper"],
    }

    with patch("app.services.auth_service.generate_otp", return_value="123456"):
        response = await client.post("/v1/auth/signup", json=signup_data)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(existing_user.id)
    assert "sign in" in data["message"].lower()

    await db_session.refresh(invite_code)
    assert invite_code.use_count == 0

    response = await client.post(
        "/v1/auth/verify-otp",
        json={"phone_or_email": existing_user.email, "otp_code": "123456"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["user"]["id"] == str(existing_user.id)
