"""Web push subscriptions: one row per browser or installed app that asked for notifications."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

ENDPOINT_MAX_LENGTH = 1024
P256DH_MAX_LENGTH = 128
AUTH_MAX_LENGTH = 64
USER_AGENT_MAX_LENGTH = 255


class PushSubscription(Base):
    """A device's push endpoint and the keys that encrypt payloads for it.

    ``endpoint`` is unique: phones are shared, so when another member turns
    notifications on from the same browser, the row moves to them. Rows go
    with the account (ON DELETE CASCADE).
    """

    __tablename__ = "push_subscriptions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    endpoint: Mapped[str] = mapped_column(String(ENDPOINT_MAX_LENGTH), nullable=False)
    p256dh: Mapped[str] = mapped_column(String(P256DH_MAX_LENGTH), nullable=False)
    auth: Mapped[str] = mapped_column(String(AUTH_MAX_LENGTH), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(USER_AGENT_MAX_LENGTH), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("endpoint", name="uq_push_subscriptions_endpoint"),)
