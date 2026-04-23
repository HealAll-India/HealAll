"""Authentication service."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS, VerificationLevel
from app.core.exceptions import (
    DuplicateException,
    ExpiredException,
    NotFoundException,
    RateLimitException,
    UnauthenticatedException,
    ValidationException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_otp,
    hash_password,
    verify_otp,
)
from app.models.user import OTPAttempt, RefreshToken, User
from app.schemas.auth import SignupRequest

settings = get_settings()


async def check_phone_exists(db: AsyncSession, phone: str) -> bool:
    """Check if phone number already exists."""
    result = await db.execute(select(User).where(User.phone == phone, User.deleted_at.is_(None)))
    return result.scalar_one_or_none() is not None


async def check_email_exists(db: AsyncSession, email: str) -> bool:
    """Check if email already exists."""
    result = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
    return result.scalar_one_or_none() is not None


async def create_user(db: AsyncSession, signup_data: SignupRequest) -> User:
    """Create a new user."""
    # Check for duplicates
    if await check_phone_exists(db, signup_data.phone):
        raise DuplicateException("Phone number already registered")

    if await check_email_exists(db, signup_data.email):
        raise DuplicateException("Email already registered")

    # Create user
    user = User(
        name=signup_data.name,
        phone=signup_data.phone,
        email=signup_data.email,
        city=signup_data.city,
        age_range=signup_data.age_range.value,
        roles=[role.value for role in signup_data.roles],
        verification_level=VerificationLevel.UNVERIFIED,
    )

    db.add(user)
    await db.flush()
    await db.refresh(user)

    return user


async def create_otp(
    db: AsyncSession,
    phone_or_email: str,
    purpose: str = "signup",
) -> tuple[str, OTPAttempt]:
    """Create a new OTP for verification."""
    # Check rate limit
    one_hour_ago = datetime.now(UTC) - timedelta(hours=1)
    result = await db.execute(
        select(OTPAttempt).where(
            OTPAttempt.phone_or_email == phone_or_email,
            OTPAttempt.created_at >= one_hour_ago,
        )
    )
    recent_attempts = result.scalars().all()

    if len(recent_attempts) >= 5:  # OTP_RATE_LIMIT_PER_HOUR
        raise RateLimitException("Too many OTP requests. Please try again in an hour.")

    # Generate OTP
    otp_plain = generate_otp()
    otp_hashed = hash_otp(otp_plain)

    # Create OTP attempt
    otp_attempt = OTPAttempt(
        phone_or_email=phone_or_email,
        otp_hash=otp_hashed,
        purpose=purpose,
        expires_at=datetime.now(UTC) + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )

    db.add(otp_attempt)
    await db.flush()
    await db.refresh(otp_attempt)

    return otp_plain, otp_attempt


async def verify_otp_code(
    db: AsyncSession,
    phone_or_email: str,
    otp_code: str,
) -> OTPAttempt:
    """Verify an OTP code."""
    # Get latest OTP for this phone/email
    result = await db.execute(
        select(OTPAttempt)
        .where(
            OTPAttempt.phone_or_email == phone_or_email,
            OTPAttempt.verified_at.is_(None),
        )
        .order_by(OTPAttempt.created_at.desc())
        .limit(1)
    )
    otp_attempt = result.scalar_one_or_none()

    if not otp_attempt:
        raise NotFoundException("No OTP found for this phone/email")

    if otp_attempt.is_expired:
        raise ExpiredException("OTP has expired. Please request a new one.")

    if otp_attempt.attempts >= OTP_MAX_ATTEMPTS:
        raise ValidationException("Maximum OTP attempts exceeded. Please request a new one.")

    # Verify OTP
    otp_attempt.attempts += 1

    if not verify_otp(otp_code, otp_attempt.otp_hash):
        await db.flush()
        raise ValidationException(f"Invalid OTP. {OTP_MAX_ATTEMPTS - otp_attempt.attempts} attempts remaining.")

    # Mark as verified
    otp_attempt.verified_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(otp_attempt)

    return otp_attempt


async def mark_phone_verified(db: AsyncSession, user: User) -> User:
    """Mark user's phone as verified."""
    user.phone_verified = True
    if user.email_verified:
        user.verification_level = VerificationLevel.PHONE_EMAIL_VERIFIED
    await db.flush()
    await db.refresh(user)
    return user


async def mark_email_verified(db: AsyncSession, user: User) -> User:
    """Mark user's email as verified."""
    user.email_verified = True
    if user.phone_verified:
        user.verification_level = VerificationLevel.PHONE_EMAIL_VERIFIED
    await db.flush()
    await db.refresh(user)
    return user


async def get_user_by_phone_or_email(db: AsyncSession, phone_or_email: str) -> User:
    """Get user by phone or email."""
    # Try phone first (assuming it starts with +)
    if phone_or_email.startswith("+"):
        result = await db.execute(select(User).where(User.phone == phone_or_email, User.deleted_at.is_(None)))
    else:
        result = await db.execute(select(User).where(User.email == phone_or_email, User.deleted_at.is_(None)))

    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    return user


async def create_tokens(db: AsyncSession, user: User) -> tuple[str, str]:
    """Create access and refresh tokens for a user."""
    # Create access token
    access_token = create_access_token(
        subject=str(user.id),
        roles=user.roles,
        verification_level=user.verification_level,
    )

    # Create refresh token
    refresh_token_value = create_refresh_token()
    refresh_token_hash = hash_password(refresh_token_value)

    refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        family_id=uuid4(),
        expires_at=datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )

    db.add(refresh_token)
    await db.flush()

    return access_token, refresh_token_value


async def verify_refresh_token(db: AsyncSession, token: str) -> RefreshToken:
    """Verify a refresh token."""
    token_hash = hash_password(token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    refresh_token = result.scalar_one_or_none()

    if not refresh_token:
        raise UnauthenticatedException("Invalid refresh token")

    if refresh_token.is_expired:
        raise ExpiredException("Refresh token has expired")

    return refresh_token


async def revoke_refresh_token(db: AsyncSession, refresh_token: RefreshToken) -> None:
    """Revoke a refresh token."""
    refresh_token.revoked_at = datetime.now(UTC)
    await db.flush()


async def revoke_all_user_tokens(db: AsyncSession, user_id: UUID) -> None:
    """Revoke all refresh tokens for a user."""
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    tokens = result.scalars().all()

    for token in tokens:
        token.revoked_at = datetime.now(UTC)

    await db.flush()
