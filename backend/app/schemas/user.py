"""User profile schemas."""
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.constants import AgeRange


class UserProfileUpdate(BaseModel):
    """Update user profile."""
    name: str | None = Field(None, min_length=2, max_length=120)
    city: str | None = Field(None, min_length=2, max_length=100)
    age_range: AgeRange | None = None
    bio: str | None = Field(None, max_length=1000)
    avatar_url: str | None = Field(None, max_length=500)


class AddSkillRequest(BaseModel):
    """Add skill to user profile."""
    skill: str = Field(..., min_length=2, max_length=100)


class SkillResponse(BaseModel):
    """Skill response."""
    id: UUID
    skill: str


class PrivacySettings(BaseModel):
    """User privacy settings."""
    show_email: bool = False
    show_phone: bool = False
    show_full_city: bool = True  # If false, only show state/region


class UpdatePrivacyRequest(BaseModel):
    """Update privacy settings."""
    show_email: bool | None = None
    show_phone: bool | None = None
    show_full_city: bool | None = None


class PublicUserProfile(BaseModel):
    """Public user profile (respects privacy settings)."""
    id: UUID
    name: str
    city: str | None = None  # May be hidden
    age_range: str
    bio: str | None = None
    avatar_url: str | None = None
    roles: list[str]
    verification_level: int
    skills: list[str] = Field(default_factory=list)
    email: str | None = None  # Only if show_email=True
    phone: str | None = None  # Only if show_phone=True


class MyUserProfile(BaseModel):
    """Own user profile (full access)."""
    id: UUID
    name: str
    email: str
    phone: str
    city: str
    age_range: str
    bio: str | None = None
    avatar_url: str | None = None
    roles: list[str]
    verification_level: int
    phone_verified: bool
    email_verified: bool
    is_active: bool
    skills: list[str] = Field(default_factory=list)
    privacy_settings: PrivacySettings


class BlockUserRequest(BaseModel):
    """Block a user."""
    pass  # User ID comes from path parameter


class BlockedUserResponse(BaseModel):
    """Blocked user info."""
    id: UUID
    blocked_user_id: UUID
    blocked_at: str
