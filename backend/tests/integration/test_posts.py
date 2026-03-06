"""Integration tests for the posts module."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite import InviteCode
from app.models.post import Post, PostCategory, PostStatus, PostUrgency
from app.models.user import User
from app.services.auth_service import create_otp


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _create_invite(db: AsyncSession, code: str = "POST-INVITE-001") -> InviteCode:
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
    name: str = "Post Test User",
) -> str:
    """Full auth flow returning a Bearer access token."""
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

    # Verify phone
    phone_otp, _ = await create_otp(db, phone, "signup")
    resp = await client.post("/v1/auth/verify-otp", json={"phone_or_email": phone, "otp_code": phone_otp})
    assert resp.status_code == 200

    # Verify email
    email_otp, _ = await create_otp(db, email, "signup")
    resp = await client.post("/v1/auth/verify-otp", json={"phone_or_email": email, "otp_code": email_otp})
    assert resp.status_code == 200

    # Login
    login_otp, _ = await create_otp(db, phone, "login")
    resp = await client.post("/v1/auth/token", json={"phone_or_email": phone, "otp_code": login_otp})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def invite(db_session: AsyncSession) -> InviteCode:
    return await _create_invite(db_session, "POST-INVITE-001")


@pytest.fixture
async def second_invite(db_session: AsyncSession) -> InviteCode:
    return await _create_invite(db_session, "POST-INVITE-002")


@pytest.fixture
async def auth_headers(client: AsyncClient, db_session: AsyncSession, invite: InviteCode) -> dict[str, str]:
    token = await _signup_and_login(
        client, db_session, invite.code,
        phone="+919800000001",
        email="postuser1@example.com",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def other_auth_headers(
    client: AsyncClient,
    db_session: AsyncSession,
    second_invite: InviteCode,
) -> dict[str, str]:
    token = await _signup_and_login(
        client, db_session, second_invite.code,
        phone="+919800000002",
        email="postuser2@example.com",
        name="Other Post User",
    )
    return {"Authorization": f"Bearer {token}"}


_VALID_POST = {
    "title": "Need help with groceries",
    "description": "I am unable to go out and need someone to buy groceries for me this week.",
    "category": PostCategory.ON_GROUND.value,
    "urgency": PostUrgency.NORMAL.value,
    "city": "Mumbai",
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_post_authenticated(client: AsyncClient, auth_headers: dict[str, str]):
    """POST /v1/posts creates a new post in DRAFT status."""
    resp = await client.post("/v1/posts", json=_VALID_POST, headers=auth_headers)

    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == _VALID_POST["title"]
    assert data["description"] == _VALID_POST["description"]
    assert data["category"] == PostCategory.ON_GROUND.value
    assert data["urgency"] == PostUrgency.NORMAL.value
    assert data["city"] == "Mumbai"
    assert data["status"] == PostStatus.DRAFT.value
    assert "id" in data
    assert "author" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_post_unauthenticated(client: AsyncClient):
    """POST /v1/posts without a token returns 401."""
    resp = await client.post("/v1/posts", json=_VALID_POST)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_post_validation_short_title(client: AsyncClient, auth_headers: dict[str, str]):
    """POST /v1/posts with a title shorter than 5 chars returns 422."""
    bad_post = {**_VALID_POST, "title": "Hi"}
    resp = await client.post("/v1/posts", json=bad_post, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_post_validation_short_description(client: AsyncClient, auth_headers: dict[str, str]):
    """POST /v1/posts with a description shorter than 20 chars returns 422."""
    bad_post = {**_VALID_POST, "description": "Too short"}
    resp = await client.post("/v1/posts", json=bad_post, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_post_by_id(client: AsyncClient, auth_headers: dict[str, str]):
    """GET /v1/posts/{id} returns post details."""
    create_resp = await client.post("/v1/posts", json=_VALID_POST, headers=auth_headers)
    assert create_resp.status_code == 201
    post_id = create_resp.json()["id"]

    resp = await client.get(f"/v1/posts/{post_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == post_id
    assert data["title"] == _VALID_POST["title"]
    assert data["status"] == PostStatus.DRAFT.value


@pytest.mark.asyncio
async def test_get_post_not_found(client: AsyncClient, auth_headers: dict[str, str]):
    """GET /v1/posts/{nonexistent_id} returns 404."""
    random_id = str(uuid4())
    resp = await client.get(f"/v1/posts/{random_id}", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_update_post(client: AsyncClient, auth_headers: dict[str, str]):
    """PATCH /v1/posts/{id} updates title and description."""
    create_resp = await client.post("/v1/posts", json=_VALID_POST, headers=auth_headers)
    assert create_resp.status_code == 201
    post_id = create_resp.json()["id"]

    update_data = {
        "title": "Updated grocery help request",
        "description": "This is an updated description that is long enough to pass validation.",
    }
    resp = await client.patch(f"/v1/posts/{post_id}", json=update_data, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == update_data["title"]
    assert data["description"] == update_data["description"]
    # Status should remain draft
    assert data["status"] == PostStatus.DRAFT.value


@pytest.mark.asyncio
async def test_update_post_not_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
):
    """PATCH /v1/posts/{id} by a different user returns 403."""
    create_resp = await client.post("/v1/posts", json=_VALID_POST, headers=auth_headers)
    assert create_resp.status_code == 201
    post_id = create_resp.json()["id"]

    update_data = {"title": "Sneaky title change attempt"}
    resp = await client.patch(f"/v1/posts/{post_id}", json=update_data, headers=other_auth_headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_submit_post(client: AsyncClient, auth_headers: dict[str, str]):
    """POST /v1/posts/{id}/submit transitions a draft post to pending_review (submitted)."""
    create_resp = await client.post("/v1/posts", json=_VALID_POST, headers=auth_headers)
    assert create_resp.status_code == 201
    post_id = create_resp.json()["id"]

    resp = await client.post(f"/v1/posts/{post_id}/submit", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == PostStatus.SUBMITTED.value


@pytest.mark.asyncio
async def test_submit_post_not_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
):
    """POST /v1/posts/{id}/submit by a non-owner returns 403."""
    create_resp = await client.post("/v1/posts", json=_VALID_POST, headers=auth_headers)
    assert create_resp.status_code == 201
    post_id = create_resp.json()["id"]

    resp = await client.post(f"/v1/posts/{post_id}/submit", headers=other_auth_headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_list_my_posts(client: AsyncClient, auth_headers: dict[str, str]):
    """GET /v1/posts lists the authenticated user's own posts."""
    # Create two posts
    for i in range(2):
        post = {**_VALID_POST, "title": f"My post number {i + 1} for listing"}
        resp = await client.post("/v1/posts", json=post, headers=auth_headers)
        assert resp.status_code == 201

    resp = await client.get("/v1/posts", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "per_page" in data
    assert "has_next" in data
    assert data["total"] >= 2
    assert len(data["items"]) >= 2


@pytest.mark.asyncio
async def test_list_my_posts_unauthenticated(client: AsyncClient):
    """GET /v1/posts without a token returns 401."""
    resp = await client.get("/v1/posts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_my_posts_excludes_other_users_posts(
    client: AsyncClient,
    auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
):
    """GET /v1/posts only returns the requesting user's posts."""
    # Create a post as user 1
    resp = await client.post("/v1/posts", json=_VALID_POST, headers=auth_headers)
    assert resp.status_code == 201
    user1_post_id = resp.json()["id"]

    # Create a post as user 2
    other_post = {**_VALID_POST, "title": "Other user post should not appear"}
    resp = await client.post("/v1/posts", json=other_post, headers=other_auth_headers)
    assert resp.status_code == 201
    user2_post_id = resp.json()["id"]

    # User 1's feed should only contain their own post
    resp = await client.get("/v1/posts", headers=auth_headers)
    assert resp.status_code == 200
    returned_ids = [item["id"] for item in resp.json()["items"]]
    assert user1_post_id in returned_ids
    assert user2_post_id not in returned_ids


@pytest.mark.asyncio
async def test_list_my_posts_pagination(client: AsyncClient, auth_headers: dict[str, str]):
    """GET /v1/posts respects page and per_page query parameters."""
    # Create 3 posts
    for i in range(3):
        post = {**_VALID_POST, "title": f"Pagination post number {i + 1} title here"}
        resp = await client.post("/v1/posts", json=post, headers=auth_headers)
        assert resp.status_code == 201

    resp = await client.get("/v1/posts?page=1&per_page=2", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["per_page"] == 2
    assert data["page"] == 1
    assert len(data["items"]) <= 2
