"""Google OAuth authentication service."""

import asyncio
from functools import partial

from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import VerificationLevel
from app.core.exceptions import (
    DuplicateException,
    UnauthenticatedException,
    ValidationException,
)
from app.models.user import User
from app.schemas.auth import GoogleSignupRequest

settings = get_settings()

# Reuse a single requests.Request session for Google cert caching
_google_request = google_requests.Request()


async def verify_google_token(token: str) -> dict:
    """Verify a Google ID token and return its payload.

    Raises UnauthenticatedException if token is invalid.
    Raises ValidationException if GOOGLE_CLIENT_ID is not configured.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise ValidationException("Google OAuth is not configured on this server")

    loop = asyncio.get_event_loop()
    verify_fn = partial(
        google_id_token.verify_oauth2_token,
        token,
        _google_request,
        settings.GOOGLE_CLIENT_ID,
    )
    try:
        payload: dict = await loop.run_in_executor(None, verify_fn)
    except (GoogleAuthError, ValueError) as exc:
        raise UnauthenticatedException(f"Invalid Google token: {exc}") from exc

    if payload.get("email_verified") is not True:
        raise UnauthenticatedException("Google account email is not verified")

    return payload


async def get_user_by_google_sub(db: AsyncSession, google_sub: str) -> User | None:
    """Find an active user by their Google subject ID."""
    result = await db.execute(
        select(User).where(User.google_sub == google_sub, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Find an active user by email."""
    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def link_google_sub(db: AsyncSession, user: User, google_sub: str) -> User:
    """Attach a Google sub to an existing user on first Google login."""
    user.google_sub = google_sub
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def create_google_user(
    db: AsyncSession,
    signup_data: GoogleSignupRequest,
    google_payload: dict,
) -> User:
    """Create a new user from Google OAuth signup.

    Email is pre-verified by Google. Phone is auto-verified per existing bypass policy.
    User reaches verification_level=1 immediately — no OTP needed.
    """
    email: str = google_payload["email"]
    name: str = google_payload.get("name") or "HealAll User"
    google_sub: str = google_payload["sub"]

    # Check for duplicates
    if await get_user_by_email(db, email) is not None:
        raise DuplicateException("Email already registered")

    existing_phone = await db.execute(
        select(User).where(User.phone == signup_data.phone, User.deleted_at.is_(None))
    )
    if existing_phone.scalar_one_or_none() is not None:
        raise DuplicateException("Phone number already registered")

    if await get_user_by_google_sub(db, google_sub) is not None:
        raise DuplicateException("Google account already registered")

    user = User(
        name=name,
        phone=signup_data.phone,
        email=email,
        city=signup_data.city,
        age_range=signup_data.age_range.value,
        roles=[role.value for role in signup_data.roles],
        google_sub=google_sub,
        email_verified=True,  # Google verifies email
        phone_verified=True,  # Auto-verify per existing policy
        verification_level=VerificationLevel.PHONE_EMAIL_VERIFIED,
    )

    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def resolve_google_login(db: AsyncSession, google_payload: dict) -> User:
    """Find or link the user for a Google login attempt.

    Lookup order:
    1. By google_sub (fast path after first Google login)
    2. By email (links google_sub on first Google login for OTP-registered users)

    Raises UnauthenticatedException if no matching user found.
    """
    google_sub: str = google_payload["sub"]
    email: str = google_payload["email"]

    # Fast path: already linked
    user = await get_user_by_google_sub(db, google_sub)
    if user:
        return user

    # Link on first Google login for users who signed up via OTP
    user = await get_user_by_email(db, email)
    if user:
        await link_google_sub(db, user, google_sub)
        return user

    raise UnauthenticatedException(
        "No HealAll account found for this Google account. Please sign up first."
    )
