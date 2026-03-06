"""Moderation reports and actions models."""
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ReportTargetType(str, Enum):
    """Supported report target types."""

    POST = "post"
    COMMENT = "comment"
    MESSAGE = "message"
    USER = "user"


class ReportReason(str, Enum):
    """Supported report reasons."""

    SPAM = "spam"
    HARASSMENT = "harassment"
    FRAUD = "fraud"
    SOLICITATION = "solicitation"
    CRISIS = "crisis"
    OTHER = "other"


class ReportStatus(str, Enum):
    """Report moderation status."""

    PENDING = "pending"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ModerationActionType(str, Enum):
    """Moderation action types."""

    WARN = "warn"
    RESTRICT = "restrict"
    SUSPEND = "suspend"
    BAN = "ban"
    DISMISS = "dismiss"


class Report(Base):
    """User generated moderation report."""

    __tablename__ = "reports"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    reporter_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    target_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=ReportStatus.PENDING.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("reporter_id", "target_type", "target_id", name="uq_reporter_target"),
    )


class ModerationAction(Base):
    """Administrative moderation action record."""

    __tablename__ = "moderation_actions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    report_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    acted_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
