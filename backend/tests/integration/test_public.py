"""Integration tests for unauthenticated public endpoints."""

from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache as cache_module
from app.models.case import Case, CaseHelper, CaseHelperStatus, CaseStatus
from app.models.post import Post, PostCategory, PostStatus, PostUrgency
from app.models.user import User


@pytest.fixture(autouse=True)
async def _flush_public_cache():
    """Drop stats/feed cache entries between tests so each case observes only
    its own DB fixtures, not stale Redis state from a prior test."""
    try:
        keys = await cache_module._client.keys("public:*")
        if keys:
            await cache_module._client.delete(*keys)
    except Exception:
        # If Redis isn't reachable in the test env the cache is a no-op
        # anyway (get_or_set falls back to the producer), so silently
        # skip the flush.
        pass
    yield


async def _make_user(
    db: AsyncSession,
    *,
    name: str = "Pub Tester",
    verification_level: int = 1,
    is_active: bool = True,
    phone_suffix: str | None = None,
) -> User:
    # Generate a digits-only 8-character suffix so the phone column never
    # contains hex letters — keeps the seed compatible with any future
    # E.164 / numeric-only validation on the User model.
    suffix = phone_suffix or f"{uuid4().int % 10**8:08d}"
    user = User(
        phone=f"+9199{suffix[:8]}",
        email=f"{suffix}@example.com",
        phone_verified=True,
        email_verified=True,
        name=name,
        city="Delhi",
        age_range="25-34",
        verification_level=verification_level,
        is_active=is_active,
        roles=["helper"],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _make_post(
    db: AsyncSession,
    author: User,
    *,
    status: str = PostStatus.ACTIVE.value,
    city: str = "Delhi",
    title: str = "Need O+ blood urgently for a patient",
    description: str = "A detailed description of the help required for the patient in question.",
    address: str | None = "12 MG Road",
    pincode: str | None = "110001",
    latitude: float | None = 28.6,
    longitude: float | None = 77.2,
    contact_prefs: dict | None = None,
) -> Post:
    post = Post(
        author_id=author.id,
        title=title,
        description=description,
        category=PostCategory.ON_GROUND.value,
        urgency=PostUrgency.URGENT.value,
        city=city,
        address=address,
        pincode=pincode,
        latitude=latitude,
        longitude=longitude,
        status=status,
        contact_prefs=contact_prefs or {"allow_dm": True, "show_phone": False},
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def _make_case(
    db: AsyncSession,
    post: Post,
    *,
    status: str = CaseStatus.ACTIVE.value,
) -> Case:
    case = Case(post_id=post.id, status=status)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


# ---------------------------------------------------------------------------
# /v1/public/stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_landing_stats_returns_counts(client: AsyncClient, db_session: AsyncSession):
    verified_one = await _make_user(db_session, verification_level=1)
    verified_two = await _make_user(db_session, verification_level=2)
    await _make_user(db_session, verification_level=0)  # unverified

    active_post = await _make_post(db_session, verified_one, status=PostStatus.ACTIVE.value, city="Delhi")
    await _make_post(db_session, verified_two, status=PostStatus.ACTIVE.value, city="Mumbai")

    await _make_case(db_session, active_post, status=CaseStatus.ACTIVE.value)
    closed_post = await _make_post(db_session, verified_two, status=PostStatus.RESOLVED.value, city="Mumbai")
    await _make_case(db_session, closed_post, status=CaseStatus.CLOSED.value)

    resp = await client.get("/v1/public/stats")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["helped"] == 1
    assert body["verified_members"] == 2
    assert body["active_cases"] == 1
    # 2 distinct cities across ACTIVE posts (Delhi, Mumbai).
    assert body["cities"] == 2
    assert "generated_at" in body


@pytest.mark.asyncio
async def test_public_stats_requires_no_auth(client: AsyncClient, db_session: AsyncSession):
    resp = await client.get("/v1/public/stats")
    assert resp.status_code == 200
    # No Authorization header was set; reach the endpoint successfully.


# ---------------------------------------------------------------------------
# /v1/public/posts
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_posts_returns_only_active(client: AsyncClient, db_session: AsyncSession):
    author = await _make_user(db_session)
    await _make_post(db_session, author, status=PostStatus.DRAFT.value)
    await _make_post(db_session, author, status=PostStatus.SUBMITTED.value)
    await _make_post(db_session, author, status=PostStatus.REJECTED.value)
    await _make_post(db_session, author, status=PostStatus.RESOLVED.value)
    active = await _make_post(db_session, author, status=PostStatus.ACTIVE.value, title="Only active post visible")

    resp = await client.get("/v1/public/posts")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    ids = [i["id"] for i in items]
    assert ids == [str(active.id)]


@pytest.mark.asyncio
async def test_public_posts_no_pii_leak(client: AsyncClient, db_session: AsyncSession):
    author = await _make_user(db_session)
    post = await _make_post(
        db_session,
        author,
        status=PostStatus.ACTIVE.value,
        address="Sensitive Plot 7, Sector 21",
        pincode="201301",
        latitude=12.3456,
        longitude=78.9012,
        contact_prefs={"allow_dm": True, "show_phone": True},
    )

    resp = await client.get("/v1/public/posts")
    assert resp.status_code == 200
    raw = resp.text

    # Sensitive substrings must never appear in the response body.
    assert "Sensitive Plot" not in raw
    assert "201301" not in raw
    assert "12.3456" not in raw
    assert "78.9012" not in raw
    assert "show_phone" not in raw
    # Author PII (phone / email) must not leak either.
    assert author.email not in raw
    assert author.phone not in raw

    # Bind to the exact post we seeded so the assertion can never validate
    # the wrong record if test ordering or sort order shifts.
    items_payload = resp.json()["items"]
    item = next((i for i in items_payload if i["id"] == str(post.id)), None)
    assert item is not None, f"Post {post.id} not found in public feed response: {items_payload}"
    for forbidden in ("address", "pincode", "latitude", "longitude", "contact_prefs"):
        assert forbidden not in item
    for forbidden in ("email", "phone", "contact_prefs"):
        assert forbidden not in item["author"]

    # Same guarantees on the single-post detail endpoint.
    detail_resp = await client.get(f"/v1/public/posts/{post.id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    for forbidden in ("address", "pincode", "latitude", "longitude", "contact_prefs"):
        assert forbidden not in detail
    for forbidden in ("email", "phone", "contact_prefs"):
        assert forbidden not in detail["author"]


@pytest.mark.asyncio
async def test_public_post_detail_resolved_is_404(client: AsyncClient, db_session: AsyncSession):
    author = await _make_user(db_session)
    resolved = await _make_post(db_session, author, status=PostStatus.RESOLVED.value)
    resp = await client.get(f"/v1/public/posts/{resolved.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_public_post_detail_active_returns_full_body(client: AsyncClient, db_session: AsyncSession):
    author = await _make_user(db_session)
    long_desc = "x" * 400
    post = await _make_post(db_session, author, status=PostStatus.ACTIVE.value, description=long_desc)
    resp = await client.get(f"/v1/public/posts/{post.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["description"] == long_desc  # detail returns full, not truncated


# ---------------------------------------------------------------------------
# /v1/public/posts/{id}/comments
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_comments_on_non_active_404(client: AsyncClient, db_session: AsyncSession):
    author = await _make_user(db_session)
    draft = await _make_post(db_session, author, status=PostStatus.DRAFT.value)
    resp = await client.get(f"/v1/public/posts/{draft.id}/comments")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_public_comments_on_active_returns_list(client: AsyncClient, db_session: AsyncSession):
    from app.models.comment import Comment

    author = await _make_user(db_session)
    post = await _make_post(db_session, author, status=PostStatus.ACTIVE.value)
    db_session.add(Comment(post_id=post.id, author_id=author.id, body="A real public comment"))
    await db_session.commit()

    resp = await client.get(f"/v1/public/posts/{post.id}/comments")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["body"] == "A real public comment"
    assert items[0]["author"]["name"] == author.name
    # No email / phone leakage on the comment author either. Asserting the
    # exact seeded values (not substring patterns) matches the feed test
    # and pinpoints failures to the actual record under inspection.
    raw = resp.text
    assert author.email not in raw
    assert author.phone not in raw


# ---------------------------------------------------------------------------
# helper_count
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_posts_helper_count(client: AsyncClient, db_session: AsyncSession):
    author = await _make_user(db_session)
    helper_one = await _make_user(db_session, phone_suffix="11111111")
    helper_two = await _make_user(db_session, phone_suffix="22222222")
    helper_withdrawn = await _make_user(db_session, phone_suffix="33333333")

    post = await _make_post(db_session, author, status=PostStatus.ACTIVE.value)
    case = await _make_case(db_session, post, status=CaseStatus.ACTIVE.value)

    db_session.add_all(
        [
            CaseHelper(case_id=case.id, user_id=helper_one.id, status=CaseHelperStatus.ACTIVE.value),
            CaseHelper(case_id=case.id, user_id=helper_two.id, status=CaseHelperStatus.ACTIVE.value),
            CaseHelper(case_id=case.id, user_id=helper_withdrawn.id, status=CaseHelperStatus.WITHDRAWN.value),
        ]
    )
    await db_session.commit()

    resp = await client.get("/v1/public/posts")
    assert resp.status_code == 200
    items_payload = resp.json()["items"]
    item = next((i for i in items_payload if i["id"] == str(post.id)), None)
    assert item is not None, f"Post {post.id} not found in public feed response: {items_payload}"
    assert item["helper_count"] == 2
