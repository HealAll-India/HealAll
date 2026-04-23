"""User model and related tables."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    pass


class User(Base, TimestampMixin, SoftDeleteMixin):
    """User model."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(15), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    age_range: Mapped[str] = mapped_column(String(10), nullable=False)
    bio: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    roles: Mapped[list[str]] = mapped_column(
        ARRAY(String(30)),
        nullable=False,
        server_default="{help_seeker}",
    )
    verification_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, index=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    skills: Mapped[list["UserSkill"]] = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.name} ({self.email})>"


class UserSkill(Base):
    """User skills."""

    __tablename__ = "user_skills"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill: Mapped[str] = mapped_column(String(100), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "skill", name="uq_user_skill"),)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="skills")


class RefreshToken(Base, TimestampMixin):
    """Refresh tokens for JWT auth."""

    __tablename__ = "refresh_tokens"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    family_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

    @property
    def is_expired(self) -> bool:
        """Check if token is expired."""
        from datetime import UTC, datetime

        return datetime.now(UTC) > self.expires_at

    @property
    def is_revoked(self) -> bool:
        """Check if token is revoked."""
        return self.revoked_at is not None


class OTPAttempt(Base, TimestampMixin):
    """OTP attempts for verification."""

    __tablename__ = "otp_attempts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    phone_or_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    otp_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False, default="signup")
    attempts: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def is_expired(self) -> bool:
        """Check if OTP is expired."""
        from datetime import UTC, datetime

        return datetime.now(UTC) > self.expires_at

    @property
    def is_verified(self) -> bool:
        """Check if OTP is verified."""
        return self.verified_at is not None
