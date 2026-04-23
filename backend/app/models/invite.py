"""Invite code model."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class InviteCode(Base, TimestampMixin):
    """Invite codes for invite-only onboarding."""

    __tablename__ = "invite_codes"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    created_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    @property
    def is_expired(self) -> bool:
        """Check if invite code is expired."""
        from datetime import UTC, datetime

        return datetime.now(UTC) > self.expires_at

    @property
    def is_available(self) -> bool:
        """Check if invite code is available for use."""
        return not self.revoked and not self.is_expired and self.use_count < self.max_uses

    def use(self) -> None:
        """Increment use count."""
        self.use_count += 1
