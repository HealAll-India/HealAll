"""Authentication schemas."""

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.constants import AgeRange, UserRole


class SignupRequest(BaseModel):
    """Signup request."""

    name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., pattern=r"^\+91\d{10}$")
    email: EmailStr
    city: str = Field(..., min_length=2, max_length=100)
    age_range: AgeRange
    invite_code: str = Field(..., min_length=5, max_length=20)
    roles: list[UserRole] = Field(..., min_length=1)

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[UserRole]) -> list[UserRole]:
        """Validate that only helper and help_seeker roles are allowed during signup."""
        allowed = {UserRole.HELPER, UserRole.HELP_SEEKER}
        for role in v:
            if role not in allowed:
                raise ValueError("Only 'helper' and 'help_seeker' roles allowed during signup")
        return v


class SignupResponse(BaseModel):
    """Signup response."""

    id: UUID
    name: str
    verification_level: int
    pending_verification: list[str]
    message: str


class VerifyOTPRequest(BaseModel):
    """OTP verification request."""

    phone_or_email: str
    otp_code: str = Field(..., min_length=6, max_length=6)


class VerifyOTPResponse(BaseModel):
    """OTP verification response.

    When the user becomes fully verified (verification_level >= 1), the response
    also includes access_token + user so the frontend can auto-login without a
    separate /token round-trip.
    """

    verified: bool
    verification_level: int
    message: str
    # Populated only when user is fully verified after this OTP
    access_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    user: "UserInfo | None" = None


class ResendOTPRequest(BaseModel):
    """Resend OTP request."""

    phone_or_email: str


class ResendOTPResponse(BaseModel):
    """Resend OTP response."""

    message: str


class LoginRequest(BaseModel):
    """Login request."""

    phone_or_email: str
    otp_code: str = Field(..., min_length=6, max_length=6)


class TokenResponse(BaseModel):
    """Token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserInfo"


class UserInfo(BaseModel):
    """User information in token response."""

    id: UUID
    name: str
    email: str
    phone: str
    city: str
    age_range: str
    roles: list[str]
    verification_level: int
    avatar_url: str | None = None


class GoogleSignupRequest(BaseModel):
    """Google OAuth signup request.

    Frontend sends invite code + Google ID token + phone + profile fields.
    Backend verifies token, creates user, returns JWT immediately.
    """

    invite_code: str = Field(..., min_length=5, max_length=20)
    id_token: str = Field(..., min_length=10)
    # Server-issued single-use nonce echoed back from the Google ID token.
    # Optional during deploy skew; the route enforces it once present.
    nonce: str | None = Field(default=None, max_length=128)
    phone: str = Field(..., pattern=r"^\+91\d{10}$")
    city: str = Field(..., min_length=2, max_length=100)
    age_range: AgeRange
    roles: list[UserRole] = Field(..., min_length=1)

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[UserRole]) -> list[UserRole]:
        """Only helper and help_seeker roles allowed during signup."""
        allowed = {UserRole.HELPER, UserRole.HELP_SEEKER}
        for role in v:
            if role not in allowed:
                raise ValueError("Only 'helper' and 'help_seeker' roles allowed during signup")
        return v


class GoogleLoginRequest(BaseModel):
    """Google OAuth login request."""

    id_token: str = Field(..., min_length=10)
    # Server-issued single-use nonce echoed back from the Google ID token.
    nonce: str | None = Field(default=None, max_length=128)


class GoogleNonceResponse(BaseModel):
    """Response for the issue-nonce endpoint."""

    nonce: str


class RefreshTokenRequest(BaseModel):
    """Refresh token request (token comes from httpOnly cookie)."""

    pass


class RevokeTokenRequest(BaseModel):
    """Revoke token request."""

    pass
