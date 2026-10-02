"""AI triage suggestions for moderation reports (human-in-the-loop audit trail)."""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TriageSeverity(str, Enum):
    """Severity suggested by the AI (or forced by a deterministic rule)."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TriageDecision(str, Enum):
    """Moderator's verdict on the suggestion."""

    ACCEPTED = "accepted"
    OVERRIDDEN = "overridden"


class ReportTriage(Base):
    """One AI suggestion for one version of a report's content.

    ``content_hash`` identifies the report version (masked content + reason),
    so an edited post gets a fresh suggestion while repeat views hit the cache.
    The AI never writes ``decided_*`` / ``final_*``: those come only from a moderator.
    """

    __tablename__ = "report_triage"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    report_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    # Raw model output, kept so the audit shows when a code rule overrode the model.
    model_severity: Mapped[str] = mapped_column(String(10), nullable=False)
    suggested_severity: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    suggested_category: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    danger_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    decided_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    final_severity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    final_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("report_id", "content_hash", name="uq_report_triage_version"),)
