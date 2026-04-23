"""Integration tests for the feed module."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite import InviteCode
from app.models.post import Post, PostCategory, PostStatus, PostUrgency
from app.services.auth_service import create_otp

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _create_invite(db: AsyncSession, code: str) -> InviteCode:
    invite = InviteCode(
        code=code,
        created_by=uuid4(),
        max_uses=10,
        use_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        revoked=False,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


async def _signup_and_login(
    client: AsyncClient,
    db: AsyncSession,
    invite_code: str,
    phone: str,
    email: str,
    name: str = "Feed Test User",
) -> tuple[str, str]:
    """Full auth flow. Returns (access_token, user_id)."""
    signup_data = {
        "name": name,
        "phone": phone,
        "email": email,
        "city": "Mumbai",
        "age_range": "18-24",
        "invite_code": invite_code,
        "roles": ["helper", "help_seeker"],
    }
    resp = await client.post("/v1/auth/signup", json=signup_data)
    assert resp.status_code == 201, f"Signup failed: {resp.text}"
    user_id = resp.json()["id"]

    phone_otp, _ = await create_otp(db, phone, "signup")
    resp = await client.post("/v1/auth/verify-otp", json={"phone_or_email": phone, "otp_code": phone_otp})
    assert resp.status_code == 200

    email_otp, _ = await create_otp(db, email, "signup")
    resp = await client.post("/v1/auth/verify-otp", json={"phone_or_email": email, "otp_code": email_otp})
    assert resp.status_code == 200

    login_otp, _ = await create_otp(db, phone, "login")
    resp = await client.post("/v1/auth/token", json={"phone_or_email": phone, "otp_code": login_otp})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"], user_id


async def _seed_active_post(
    db: AsyncSession,
    author_id: str,
    title: str = "Active help request for testing",
    description: str = "This is a seeded active post for feed tests with enough description text.",
    category: str = PostCategory.ON_GROUND.value,
    urgency: str = PostUrgency.NORMAL.value,
    city: str = "Mumbai",
) -> Post:
    """Insert a post directly with ACTIVE status so it appears in the feed."""
    from uuid import UUID
    post = Post(
        author_id=UUID(author_id),
        title=title,
        description=description,
        category=category,
        urgency=urgency,
        city=city,
        status=PostStatus.ACTIVE.value,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def feed_invite(db_session: AsyncSession) -> InviteCode:
    return await _create_invite(db_session, "FEED-INVITE-001")


@pytest.fixture
async def feed_invite2(db_session: AsyncSession) -> InviteCode:
    return await _create_invite(db_session, "FEED-INVITE-002")


@pytest.fixture
async def auth_headers_and_id(
    client: AsyncClient,
    db_session: AsyncSession,
    feed_invite: InviteCode,
) -> tuple[dict[str, str], str]:
    token, user_id = await _signup_and_login(
        client, db_session, feed_invite.code,
        phone="+919811000001",
        email="feeduser1@example.com",
    )
    return {"Authorization": f"Bearer {token}"}, user_id


@pytest.fixture
async def auth_headers(
    auth_headers_and_id: tuple[dict[str, str], str],
) -> dict[str, str]:
    return auth_headers_and_id[0]


@pytest.fixture
async def viewer_user_id(
    auth_headers_and_id: tuple[dict[str, str], str],
) -> str:
    return auth_headers_and_id[1]


@pytest.fixture
async def second_auth_headers_and_id(
    client: AsyncClient,
    db_session: AsyncSession,
    feed_invite2: InviteCode,
) -> tuple[dict[str, str], str]:
    token, user_id = await _signup_and_login(
        client, db_session, feed_invite2.code,
        phone="+919811000002",
        email="feeduser2@example.com",
        name="Feed User Two",
    )
    return {"Authorization": f"Bearer {token}"}, user_id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_feed_requires_auth(client: AsyncClient):
    """GET /v1/feed without a token returns 401."""
    resp = await client.get("/v1/feed")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_feed_returns_posts(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed returns active posts."""
    await _seed_active_post(db_session, viewer_user_id, title="Visible feed post one here")

    resp = await client.get("/v1/feed", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "per_page" in data
    assert "has_next" in data
    assert data["total"] >= 1
    titles = [item["title"] for item in data["items"]]
    assert "Visible feed post one here" in titles


@pytest.mark.asyncio
async def test_feed_does_not_return_draft_posts(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed does not return posts in DRAFT status."""
    from uuid import UUID
    draft_post = Post(
        author_id=UUID(viewer_user_id),
        title="Draft post should not appear in feed",
        description="This draft should be hidden from the public feed entirely.",
        category=PostCategory.ON_GROUND.value,
        urgency=PostUrgency.NORMAL.value,
        city="Mumbai",
        status=PostStatus.DRAFT.value,
    )
    db_session.add(draft_post)
    await db_session.commit()

    resp = await client.get("/v1/feed", headers=auth_headers)
    assert resp.status_code == 200
    titles = [item["title"] for item in resp.json()["items"]]
    assert "Draft post should not appear in feed" not in titles


@pytest.mark.asyncio
async def test_feed_filter_by_city(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed?city= filters posts by city."""
    await _seed_active_post(db_session, viewer_user_id, title="Mumbai help post city filter", city="Mumbai")
    await _seed_active_post(db_session, viewer_user_id, title="Delhi help post city filter", city="Delhi")

    resp = await client.get("/v1/feed?city=Mumbai", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["city"] == "Mumbai"


@pytest.mark.asyncio
async def test_feed_filter_by_category(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed?category= filters posts by category."""
    await _seed_active_post(
        db_session, viewer_user_id,
        title="Mentorship category feed test post",
        category=PostCategory.MENTORSHIP.value,
    )
    await _seed_active_post(
        db_session, viewer_user_id,
        title="Skill sharing category feed test post",
        category=PostCategory.SKILL_SHARING.value,
    )

    resp = await client.get(
        f"/v1/feed?category={PostCategory.MENTORSHIP.value}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["category"] == PostCategory.MENTORSHIP.value


@pytest.mark.asyncio
async def test_feed_filter_by_urgency(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed?urgency= filters posts by urgency level."""
    await _seed_active_post(
        db_session, viewer_user_id,
        title="Critical urgency feed test post here",
        urgency=PostUrgency.CRITICAL.value,
    )
    await _seed_active_post(
        db_session, viewer_user_id,
        title="Low urgency feed test post here now",
        urgency=PostUrgency.LOW.value,
    )

    resp = await client.get(
        f"/v1/feed?urgency={PostUrgency.CRITICAL.value}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["urgency"] == PostUrgency.CRITICAL.value


@pytest.mark.asyncio
async def test_feed_search(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed?search= filters posts by keyword in title or description."""
    await _seed_active_post(
        db_session, viewer_user_id,
        title="Unique wheelchair access ramp search test",
        description="Looking for help with wheelchair ramp installation near my building.",
    )
    await _seed_active_post(
        db_session, viewer_user_id,
        title="Completely unrelated post with different content",
        description="This post has nothing to do with wheelchairs or ramps at all.",
    )

    resp = await client.get("/v1/feed?search=wheelchair", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    matched_titles = [item["title"] for item in data["items"]]
    assert any("wheelchair" in t.lower() for t in matched_titles)


@pytest.mark.asyncio
async def test_feed_search_no_results(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """GET /v1/feed?search= with a term that matches nothing returns empty items."""
    resp = await client.get("/v1/feed?search=xyzzy_no_match_string_12345", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_feed_pagination(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed respects page and per_page query params."""
    for i in range(4):
        await _seed_active_post(
            db_session, viewer_user_id,
            title=f"Pagination feed test post number {i + 1}",
        )

    resp_page1 = await client.get("/v1/feed?page=1&per_page=2", headers=auth_headers)
    assert resp_page1.status_code == 200
    data_page1 = resp_page1.json()
    assert data_page1["page"] == 1
    assert data_page1["per_page"] == 2
    assert len(data_page1["items"]) <= 2

    resp_page2 = await client.get("/v1/feed?page=2&per_page=2", headers=auth_headers)
    assert resp_page2.status_code == 200
    data_page2 = resp_page2.json()
    assert data_page2["page"] == 2

    # Items on page 1 and page 2 should not overlap
    ids_page1 = {item["id"] for item in data_page1["items"]}
    ids_page2 = {item["id"] for item in data_page2["items"]}
    assert ids_page1.isdisjoint(ids_page2)


@pytest.mark.asyncio
async def test_feed_pagination_has_next(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed has_next is True when more pages exist, False on the last page."""
    for i in range(3):
        await _seed_active_post(
            db_session, viewer_user_id,
            title=f"Has next test post number {i + 1} feed item",
        )

    resp = await client.get("/v1/feed?page=1&per_page=2", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    if data["total"] > 2:
        assert data["has_next"] is True
    else:
        assert data["has_next"] is False


@pytest.mark.asyncio
async def test_feed_response_structure(
    client: AsyncClient,
    auth_headers: dict[str, str],
    viewer_user_id: str,
    db_session: AsyncSession,
):
    """GET /v1/feed each item has required fields."""
    await _seed_active_post(db_session, viewer_user_id, title="Structure check post for feed endpoint")

    resp = await client.get("/v1/feed", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) >= 1

    item = items[0]
    for field in ("id", "title", "description", "category", "urgency", "city", "status", "author", "created_at"):
        assert field in item, f"Missing field '{field}' in feed item"

    author = item["author"]
    for field in ("id", "name", "verification_level"):
        assert field in author, f"Missing author field '{field}'"
