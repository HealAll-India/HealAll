"""Case lifecycle models."""
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CaseStatus(str, Enum):
    """Supported case lifecycle states."""

    ACTIVE = "active"
    CLOSURE_REQUESTED = "closure_requested"
    CLOSED = "closed"
    REOPENED = "reopened"


class CaseHelperStatus(str, Enum):
    """Helper membership status inside a case."""

    ACTIVE = "active"
    WITHDRAWN = "withdrawn"


class Case(Base, TimestampMixin):
    """Primary case record created when a post is verified."""

    __tablename__ = "cases"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    owner_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CaseStatus.ACTIVE.value, index=True)
    closure_requested_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    closure_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    helpers: Mapped[list["CaseHelper"]] = relationship(
        "CaseHelper",
        back_populates="case",
        cascade="all, delete-orphan",
    )
    notes: Mapped[list["CaseNote"]] = relationship(
        "CaseNote",
        back_populates="case",
        cascade="all, delete-orphan",
    )
    closures: Mapped[list["CaseClosure"]] = relationship(
        "CaseClosure",
        back_populates="case",
        cascade="all, delete-orphan",
    )


class CaseHelper(Base):
    """Users who offered support on a case."""

    __tablename__ = "case_helpers"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    case_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CaseHelperStatus.ACTIVE.value,
        index=True,
    )
    offered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("case_id", "user_id", name="uq_case_helper_membership"),)

    case: Mapped["Case"] = relationship("Case", back_populates="helpers")


class CaseNote(Base):
    """Progress notes attached to a case by its team."""

    __tablename__ = "case_notes"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    case_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    support_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    hours_contributed: Mapped[float | None] = mapped_column(Float, nullable=True)
    attachment_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    case: Mapped["Case"] = relationship("Case", back_populates="notes")


class CaseClosure(Base):
    """Closure records for a case."""

    __tablename__ = "case_closures"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    case_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    closed_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    confirmed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolution_type: Mapped[str] = mapped_column(String(30), nullable=False)
    remarks: Mapped[str] = mapped_column(Text, nullable=False)
    impact_story: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    case: Mapped["Case"] = relationship("Case", back_populates="closures")
