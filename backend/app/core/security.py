"""Security utilities for authentication and authorization."""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.constants import UserRole

settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_otp(otp: str) -> str:
    """Hash an OTP code."""
    return pwd_context.hash(otp)


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Verify an OTP code against its hash."""
    return pwd_context.verify(plain_otp, hashed_otp)


# JWT tokens
def create_access_token(
    subject: str,
    roles: list[str],
    verification_level: int,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: dict[str, Any] = {
        "sub": subject,
        "roles": roles,
        "verification_level": verification_level,
        "exp": expire,
        "iat": datetime.now(UTC),
    }

    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token() -> str:
    """Create a cryptographically secure refresh token."""
    return secrets.token_urlsafe(32)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e


def has_role(user_roles: list[str], required_role: UserRole) -> bool:
    """Check if user has a required role."""
    return required_role.value in user_roles


def has_any_role(user_roles: list[str], required_roles: list[UserRole]) -> bool:
    """Check if user has any of the required roles."""
    return any(role.value in user_roles for role in required_roles)


def generate_otp() -> str:
    """Generate a random 6-digit OTP."""
    from app.core.constants import OTP_LENGTH

    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))


def generate_invite_code() -> str:
    """Generate a unique invite code."""
    from app.core.constants import INVITE_CODE_LENGTH, INVITE_CODE_PREFIX

    code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(INVITE_CODE_LENGTH))
    return f"{INVITE_CODE_PREFIX}{code}"
