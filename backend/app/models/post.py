"""Post (help request) models."""

from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class PostStatus(str, Enum):
    """Post status."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    NEEDS_INFO = "needs_info"
    VERIFIED = "verified"
    REJECTED = "rejected"
    ACTIVE = "active"
    RESOLVED = "resolved"


class PostCategory(str, Enum):
    """Post categories."""

    EMOTIONAL_SUPPORT = "emotional_support"
    MENTORSHIP = "mentorship"
    SKILL_SHARING = "skill_sharing"
    NAVIGATION = "navigation"
    ON_GROUND = "on_ground"
    URGENT = "urgent"


class PostUrgency(str, Enum):
    """Post urgency levels."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class Post(Base, TimestampMixin, SoftDeleteMixin):
    """Help request post."""

    __tablename__ = "posts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    author_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    urgency: Mapped[str] = mapped_column(String(10), nullable=False, default="normal", index=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Nearest landmark / street address — required on new posts (enforced in API
    # schema), nullable on the column so legacy posts don't fail to migrate.
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    # Optional map pin coordinates
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    contact_prefs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Full-text search (using raw SQL for tsvector)
    # We'll handle this in migration with computed column

    __table_args__ = (
        Index(
            "idx_posts_feed",
            "urgency",
            "created_at",
            postgresql_where=text("status = 'active' AND deleted_at IS NULL"),
        ),
    )

    media_items: Mapped[list["PostMedia"]] = relationship(
        "PostMedia",
        back_populates="post",
        cascade="all, delete-orphan",
    )


class PostMedia(Base, TimestampMixin):
    """Post media attachments."""

    __tablename__ = "post_media"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    post: Mapped["Post"] = relationship("Post", back_populates="media_items")


class VoteDecision(str, Enum):
    """Community-verification vote decision."""

    APPROVE = "approve"
    REJECT = "reject"
    NEEDS_INFO = "needs_info"


class PostVerificationVote(Base, TimestampMixin):
    """A single community member's vote on a SUBMITTED post.

    Three APPROVE votes from distinct verified users flip the post to ACTIVE.
    A REJECT or NEEDS_INFO vote is informational unless an admin acts on it.
    """

    __tablename__ = "post_verification_votes"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    voter_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("post_id", "voter_id", name="uq_post_vote_once_per_user"),)
