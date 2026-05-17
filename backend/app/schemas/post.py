"""Post schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.post import PostCategory, PostUrgency

PINCODE_PATTERN = r"^[1-9][0-9]{5}$"  # India 6-digit, no leading zero


class CreatePostRequest(BaseModel):
    """Create a new help request post.

    Location is mandatory on new posts:
    - `city` + `address` + `pincode` are required.
    - `latitude` + `longitude` are optional (set when the user pins on the map).
      If either coordinate is provided, both must be.
    """

    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=5000)
    category: PostCategory
    urgency: PostUrgency = PostUrgency.NORMAL
    city: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=3, max_length=300)
    pincode: str = Field(..., pattern=PINCODE_PATTERN)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    contact_prefs: dict[str, bool] | None = None

    @model_validator(mode="after")
    def coords_paired(self) -> "CreatePostRequest":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be set together")
        return self


class UpdatePostRequest(BaseModel):
    """Update a post."""

    title: str | None = Field(None, min_length=5, max_length=200)
    description: str | None = Field(None, min_length=20, max_length=5000)
    category: PostCategory | None = None
    urgency: PostUrgency | None = None
    address: str | None = Field(None, min_length=3, max_length=300)
    pincode: str | None = Field(None, pattern=PINCODE_PATTERN)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    contact_prefs: dict[str, bool] | None = None

    @model_validator(mode="after")
    def coords_paired(self) -> "UpdatePostRequest":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be set together")
        return self


class AuthorInfo(BaseModel):
    """Post author information."""

    id: UUID
    name: str
    verification_level: int


class PostResponse(BaseModel):
    """Post response."""

    id: UUID
    title: str
    description: str
    category: str
    urgency: str
    city: str
    address: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str
    author: AuthorInfo
    created_at: datetime
    updated_at: datetime


class PostSummary(BaseModel):
    """Post summary for feed."""

    id: UUID
    title: str
    description: str  # Will be truncated in service layer
    category: str
    urgency: str
    city: str
    pincode: str | None = None
    status: str
    author: AuthorInfo
    created_at: datetime


class FeedResponse(BaseModel):
    """Feed response with pagination."""

    items: list[PostSummary]
    page: int
    per_page: int
    total: int
    has_next: bool
