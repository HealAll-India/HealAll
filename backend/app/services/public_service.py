"""Read-only services backing the public ``/v1/public/*`` namespace.

Every helper here is invoked from an unauthenticated route. Responses
are shaped via ``schemas/public.py`` (a narrower projection of the
authenticated models) so private fields can't leak out by accident. All
helpers degrade gracefully on Redis failure — see ``core/cache.py``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_or_set
from app.core.exceptions import NotFoundException
from app.models.case import Case, CaseHelper, CaseHelperStatus, CaseStatus
from app.models.comment import Comment
from app.models.post import Post, PostStatus
from app.models.user import User

# Cache TTLs (seconds). Bump the version suffix on a key when the shape
# changes — that invalidates without writing an alembic migration.
_STATS_TTL = 30
_FEED_TTL = 30
_DESCRIPTION_PREVIEW_CHARS = 200

# Active-ish case states for the "active_cases" stat. Closed is the only
# terminal state we exclude.
_ACTIVE_CASE_STATES = (
    CaseStatus.ACTIVE.value,
    CaseStatus.CLOSURE_REQUESTED.value,
    CaseStatus.REOPENED.value,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _truncate(text: str, limit: int = _DESCRIPTION_PREVIEW_CHARS) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


async def _helper_counts(db: AsyncSession, post_ids: list[UUID]) -> dict[UUID, int]:
    """Return active-helper count keyed by post_id for the given posts."""
    if not post_ids:
        return {}
    rows = await db.execute(
        select(Case.post_id, func.count(CaseHelper.id))
        .join(CaseHelper, CaseHelper.case_id == Case.id)
        .where(
            Case.post_id.in_(post_ids),
            CaseHelper.status == CaseHelperStatus.ACTIVE.value,
        )
        .group_by(Case.post_id)
    )
    return {row[0]: int(row[1]) for row in rows.all()}


def _author_payload(author: User | None) -> dict[str, object]:
    if author is None:
        # Defensive: orphaned post should never happen, but if it does we
        # surface a placeholder author rather than 500ing the landing page.
        return {"id": str(UUID(int=0)), "name": "Member", "verification_level": 0}
    return {
        "id": str(author.id),
        "name": author.name,
        "verification_level": author.verification_level,
    }


def _post_to_summary(post: Post, author: User | None, helper_count: int) -> dict[str, object]:
    return {
        "id": str(post.id),
        "title": post.title,
        "description": _truncate(post.description),
        "category": post.category,
        "urgency": post.urgency,
        "city": post.city,
        "status": post.status,
        "helper_count": helper_count,
        "author": _author_payload(author),
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }


# ---------------------------------------------------------------------------
# Landing stats
# ---------------------------------------------------------------------------


async def _compute_stats(db: AsyncSession) -> dict[str, object]:
    helped_q = select(func.count(Case.id)).where(Case.status == CaseStatus.CLOSED.value)
    verified_q = select(func.count(User.id)).where(
        User.verification_level >= 1,
        User.is_active.is_(True),
    )
    active_q = select(func.count(Case.id)).where(Case.status.in_(_ACTIVE_CASE_STATES))
    cities_q = select(func.count(func.distinct(Post.city))).where(
        Post.status == PostStatus.ACTIVE.value,
        Post.deleted_at.is_(None),
    )

    # SQLAlchemy AsyncSession is NOT safe for concurrent use; running these
    # under asyncio.gather on the same session crashes under load. Sequential
    # awaits are fast enough at landing-page scale (four indexed counts) and
    # the result is cached for 30s so the call rarely repeats.
    helped = await db.scalar(helped_q)
    verified = await db.scalar(verified_q)
    active = await db.scalar(active_q)
    cities = await db.scalar(cities_q)

    return {
        "helped": int(helped or 0),
        "verified_members": int(verified or 0),
        "active_cases": int(active or 0),
        "cities": int(cities or 0),
        "generated_at": datetime.now(UTC).isoformat(),
    }


async def get_landing_stats(db: AsyncSession) -> dict[str, object]:
    return await get_or_set(
        "public:stats:v1",
        _STATS_TTL,
        lambda: _compute_stats(db),
    )


# ---------------------------------------------------------------------------
# Public feed
# ---------------------------------------------------------------------------


async def _compute_public_feed(
    db: AsyncSession,
    page: int,
    per_page: int,
    city: str | None,
    category: str | None,
    urgency: str | None,
) -> dict[str, object]:
    base = select(Post).where(
        Post.status == PostStatus.ACTIVE.value,
        Post.deleted_at.is_(None),
    )
    if city:
        base = base.where(Post.city == city)
    if category:
        base = base.where(Post.category == category)
    if urgency:
        base = base.where(Post.urgency == urgency)

    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0

    rows = await db.execute(
        base.order_by(Post.urgency.desc(), Post.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    posts = list(rows.scalars().all())

    author_ids = list({p.author_id for p in posts})
    authors: dict[UUID, User] = {}
    if author_ids:
        rows_a = await db.execute(select(User).where(User.id.in_(author_ids)))
        authors = {u.id: u for u in rows_a.scalars().all()}

    helper_map = await _helper_counts(db, [p.id for p in posts])

    items = [_post_to_summary(p, authors.get(p.author_id), helper_map.get(p.id, 0)) for p in posts]
    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total": int(total),
        "has_next": (page * per_page) < int(total),
    }


def _feed_cache_key(
    page: int, per_page: int, city: str | None, category: str | None, urgency: str | None
) -> str | None:
    """Return cache key for landing-shape requests, or None to bypass.

    We only cache the unfiltered first page — that's the landing case and
    the bulk of public traffic. Filtered or paginated requests skip cache
    to avoid blowing up Redis cardinality.
    """
    if page == 1 and not (city or category or urgency):
        return f"public:feed:v1:p1:n{per_page}"
    return None


async def get_public_feed(
    db: AsyncSession,
    page: int,
    per_page: int,
    city: str | None,
    category: str | None,
    urgency: str | None,
) -> dict[str, object]:
    key = _feed_cache_key(page, per_page, city, category, urgency)
    if key is None:
        return await _compute_public_feed(db, page, per_page, city, category, urgency)
    return await get_or_set(
        key,
        _FEED_TTL,
        lambda: _compute_public_feed(db, page, per_page, city, category, urgency),
    )


# ---------------------------------------------------------------------------
# Public post detail
# ---------------------------------------------------------------------------


async def _load_active_post(db: AsyncSession, post_id: UUID) -> Post:
    """Return the post only if it's currently visible to anonymous viewers.

    Public-facing rule is stricter than ``comment_service._get_visible_post``:
    we deliberately treat RESOLVED posts as private from anonymous viewers
    so historical-but-now-resolved sensitive context is not exposed.
    """
    result = await db.execute(
        select(Post).where(
            Post.id == post_id,
            Post.deleted_at.is_(None),
            Post.status == PostStatus.ACTIVE.value,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundException("Post not found")
    return post


async def get_public_post(db: AsyncSession, post_id: UUID) -> dict[str, object]:
    post = await _load_active_post(db, post_id)

    author = await db.scalar(select(User).where(User.id == post.author_id))
    helper_map = await _helper_counts(db, [post.id])

    detail = _post_to_summary(post, author, helper_map.get(post.id, 0))
    # Override the truncated description with the full body for the detail
    # view. Same field set, no extra leakage.
    detail["description"] = post.description
    return detail


# ---------------------------------------------------------------------------
# Public comments
# ---------------------------------------------------------------------------


async def list_public_comments(db: AsyncSession, post_id: UUID) -> list[dict[str, object]]:
    # Reuses the public-active-only rule.
    post = await _load_active_post(db, post_id)

    rows = await db.execute(
        select(Comment)
        .where(Comment.post_id == post.id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.asc())
    )
    comments = list(rows.scalars().all())
    if not comments:
        return []

    author_ids = list({c.author_id for c in comments})
    rows_a = await db.execute(select(User).where(User.id.in_(author_ids)))
    authors = {u.id: u for u in rows_a.scalars().all()}

    out: list[dict[str, object]] = []
    for c in comments:
        a = authors.get(c.author_id)
        out.append(
            {
                "id": str(c.id),
                "post_id": str(c.post_id),
                "author": {
                    "id": str(a.id) if a else str(UUID(int=0)),
                    "name": a.name if a else "Member",
                    "verification_level": a.verification_level if a else 0,
                },
                "body": c.body,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
        )
    return out
