"""Privacy and blocking models."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserPrivacySettings(Base, TimestampMixin):
    """User privacy settings."""

    __tablename__ = "user_privacy_settings"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    show_email: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    show_phone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    show_full_city: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class UserBlock(Base, TimestampMixin):
    """User blocking relationship."""

    __tablename__ = "user_blocks"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    blocker_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_blocker_blocked"),
    )
