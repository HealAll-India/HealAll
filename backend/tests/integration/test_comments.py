"""Integration tests for the comment endpoints."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite import InviteCode
from app.models.post import Post, PostStatus

# ---------------------------------------------------------------------------
# Shared auth helper
# ---------------------------------------------------------------------------

async def _create_authenticated_user(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: str,
    *,
    name: str,
    phone: str,
    email: str,
) -> tuple[dict[str, str], str]:
    """
    Sign up, verify phone + email OTPs, log in.
    Returns (auth_headers, user_id_str).
    """
    from app.services.auth_service import create_otp

    signup_data = {
        "name": name,
        "phone": phone,
        "email": email,
        "city": "Pune",
        "age_range": "25-34",
        "invite_code": invite_code,
        "roles": ["helper", "help_seeker"],
    }
    resp = await client.post("/v1/auth/signup", json=signup_data)
    assert resp.status_code == 201, resp.text
    user_id = resp.json()["id"]

    phone_otp, _ = await create_otp(db_session, phone, "signup")
    await client.post(
        "/v1/auth/verify-otp",
        json={"phone_or_email": phone, "otp_code": phone_otp},
    )

    email_otp, _ = await create_otp(db_session, email, "signup")
    await client.post(
        "/v1/auth/verify-otp",
        json={"phone_or_email": email, "otp_code": email_otp},
    )

    login_otp, _ = await create_otp(db_session, phone, "login")
    resp = await client.post(
        "/v1/auth/token",
        json={"phone_or_email": phone, "otp_code": login_otp},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def invite_code(db_session: AsyncSession) -> InviteCode:
    invite = InviteCode(
        code="CMT-INVITE-001",
        created_by=uuid4(),
        max_uses=10,
        use_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        revoked=False,
    )
    db_session.add(invite)
    await db_session.commit()
    await db_session.refresh(invite)
    return invite


@pytest.fixture
async def author_user(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: InviteCode,
) -> tuple[dict[str, str], str]:
    """The post author who also writes a comment."""
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Post Author",
        phone="+917000000001",
        email="author@example.com",
    )


@pytest.fixture
async def commenter_user(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: InviteCode,
) -> tuple[dict[str, str], str]:
    """A different user who writes a comment."""
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Commenter User",
        phone="+917000000002",
        email="commenter@example.com",
    )


async def _seed_active_post(db_session: AsyncSession, author_id) -> Post:
    """Create an active post so that comments can be made on it."""
    post = Post(
        author_id=author_id,
        title="Looking for mentorship guidance",
        description="I need help navigating a career change.",
        category="mentorship",
        urgency="low",
        city="Pune",
        status=PostStatus.ACTIVE.value,
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_add_comment(
    client: AsyncClient,
    db_session: AsyncSession,
    author_user: tuple,
    commenter_user: tuple,
):
    """POST /v1/posts/{id}/comments adds a comment to an active post."""
    headers_author, user_id_author = author_user
    headers_commenter, user_id_commenter = commenter_user

    post = await _seed_active_post(db_session, user_id_author)

    resp = await client.post(
        f"/v1/posts/{post.id}/comments",
        json={"body": "This is a helpful comment."},
        headers=headers_commenter,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["body"] == "This is a helpful comment."
    assert data["post_id"] == str(post.id)
    assert data["author"]["id"] == user_id_commenter
    assert "created_at" in data


@pytest.mark.asyncio
async def test_list_comments(
    client: AsyncClient,
    db_session: AsyncSession,
    author_user: tuple,
    commenter_user: tuple,
):
    """GET /v1/posts/{id}/comments returns all visible comments on a post."""
    headers_author, user_id_author = author_user
    headers_commenter, _user_id_commenter = commenter_user

    post = await _seed_active_post(db_session, user_id_author)

    await client.post(
        f"/v1/posts/{post.id}/comments",
        json={"body": "First comment here."},
        headers=headers_commenter,
    )
    await client.post(
        f"/v1/posts/{post.id}/comments",
        json={"body": "Second comment here."},
        headers=headers_author,
    )

    resp = await client.get(
        f"/v1/posts/{post.id}/comments",
        headers=headers_commenter,
    )
    assert resp.status_code == 200
    comments = resp.json()
    assert isinstance(comments, list)
    assert len(comments) == 2
    bodies = [c["body"] for c in comments]
    assert "First comment here." in bodies
    assert "Second comment here." in bodies


@pytest.mark.asyncio
async def test_add_comment_unauthenticated(
    client: AsyncClient,
    db_session: AsyncSession,
    author_user: tuple,
):
    """POST /v1/posts/{id}/comments without auth returns 401."""
    _headers, user_id_author = author_user
    post = await _seed_active_post(db_session, user_id_author)

    resp = await client.post(
        f"/v1/posts/{post.id}/comments",
        json={"body": "Anonymous comment attempt."},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_own_comment(
    client: AsyncClient,
    db_session: AsyncSession,
    author_user: tuple,
    commenter_user: tuple,
):
    """DELETE /v1/comments/{id} allows the author to soft-delete their comment."""
    headers_author, user_id_author = author_user
    headers_commenter, _user_id_commenter = commenter_user

    post = await _seed_active_post(db_session, user_id_author)

    create_resp = await client.post(
        f"/v1/posts/{post.id}/comments",
        json={"body": "Comment I will delete."},
        headers=headers_commenter,
    )
    assert create_resp.status_code == 201
    comment_id = create_resp.json()["id"]

    delete_resp = await client.delete(
        f"/v1/comments/{comment_id}",
        headers=headers_commenter,
    )
    assert delete_resp.status_code == 204

    # The deleted comment should no longer appear in the list
    list_resp = await client.get(
        f"/v1/posts/{post.id}/comments",
        headers=headers_commenter,
    )
    assert list_resp.status_code == 200
    comment_ids = [c["id"] for c in list_resp.json()]
    assert comment_id not in comment_ids


@pytest.mark.asyncio
async def test_delete_other_comment_forbidden(
    client: AsyncClient,
    db_session: AsyncSession,
    author_user: tuple,
    commenter_user: tuple,
):
    """DELETE /v1/comments/{id} returns 403 when the requester is not the author."""
    headers_author, user_id_author = author_user
    headers_commenter, _user_id_commenter = commenter_user

    post = await _seed_active_post(db_session, user_id_author)

    # Commenter creates a comment
    create_resp = await client.post(
        f"/v1/posts/{post.id}/comments",
        json={"body": "A comment by the commenter."},
        headers=headers_commenter,
    )
    assert create_resp.status_code == 201
    comment_id = create_resp.json()["id"]

    # Post author (different user, non-admin) tries to delete it
    delete_resp = await client.delete(
        f"/v1/comments/{comment_id}",
        headers=headers_author,
    )
    assert delete_resp.status_code == 403


@pytest.mark.asyncio
async def test_comment_on_nonexistent_post(
    client: AsyncClient,
    author_user: tuple,
):
    """POST /v1/posts/{id}/comments on a missing post returns 404."""
    headers_author, _user_id = author_user
    fake_post_id = uuid4()

    resp = await client.post(
        f"/v1/posts/{fake_post_id}/comments",
        json={"body": "Comment on a ghost post."},
        headers=headers_author,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_comments_on_nonexistent_post(
    client: AsyncClient,
    author_user: tuple,
):
    """GET /v1/posts/{id}/comments on a missing post returns 404."""
    headers_author, _user_id = author_user
    fake_post_id = uuid4()

    resp = await client.get(
        f"/v1/posts/{fake_post_id}/comments",
        headers=headers_author,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_comment_body_too_short(
    client: AsyncClient,
    db_session: AsyncSession,
    author_user: tuple,
    commenter_user: tuple,
):
    """POST /v1/posts/{id}/comments with an empty body returns 422."""
    headers_author, user_id_author = author_user
    headers_commenter, _user_id_commenter = commenter_user

    post = await _seed_active_post(db_session, user_id_author)

    resp = await client.post(
        f"/v1/posts/{post.id}/comments",
        json={"body": ""},
        headers=headers_commenter,
    )
    assert resp.status_code == 422
