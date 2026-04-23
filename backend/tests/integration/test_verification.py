"""Integration tests for the verification queue API endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.security import create_access_token
from app.models.post import Post, PostCategory, PostStatus, PostUrgency
from app.models.user import User
from app.models.verification import VerificationDecision

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def regular_user(db_session: AsyncSession) -> User:
    """Create a regular user with helper + help_seeker roles."""
    user = User(
        name="Regular User",
        phone="+913333333301",
        email="verif_regular@example.com",
        city="Mumbai",
        age_range="18-24",
        roles=[UserRole.HELPER.value, UserRole.HELP_SEEKER.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def verifier_user(db_session: AsyncSession) -> User:
    """Create a user with the case_verifier role."""
    user = User(
        name="Verifier User",
        phone="+913333333302",
        email="verif_verifier@example.com",
        city="Delhi",
        age_range="25-34",
        roles=[UserRole.CASE_VERIFIER.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user."""
    user = User(
        name="Admin User",
        phone="+913333333303",
        email="verif_admin@example.com",
        city="Bangalore",
        age_range="35-44",
        roles=[UserRole.ADMIN.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def post_author(db_session: AsyncSession) -> User:
    """Create the author of a help-request post."""
    user = User(
        name="Post Author",
        phone="+913333333304",
        email="verif_author@example.com",
        city="Pune",
        age_range="18-24",
        roles=[UserRole.HELP_SEEKER.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def submitted_post(db_session: AsyncSession, post_author: User) -> Post:
    """Create a post in SUBMITTED status so it appears in the queue."""
    post = Post(
        author_id=post_author.id,
        title="Need help with medical bills",
        description="I am unable to afford my medical bills and need support.",
        category=PostCategory.URGENT.value,
        urgency=PostUrgency.HIGH.value,
        city="Pune",
        status=PostStatus.SUBMITTED.value,
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


def _auth_headers(user: User) -> dict[str, str]:
    """Build a Bearer token header for the given user."""
    token = create_access_token(
        subject=str(user.id),
        roles=user.roles,
        verification_level=user.verification_level,
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_verification_queue(
    client: AsyncClient,
    verifier_user: User,
    submitted_post: Post,
):
    """Case verifier can retrieve the list of posts awaiting verification."""
    response = await client.get(
        "/v1/verification/queue",
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "per_page" in data
    assert data["total"] >= 1

    post_ids = [item["post_id"] for item in data["items"]]
    assert str(submitted_post.id) in post_ids


@pytest.mark.asyncio
async def test_get_verification_queue_admin(
    client: AsyncClient,
    admin_user: User,
    submitted_post: Post,
):
    """Admin also has access to the verification queue."""
    response = await client.get(
        "/v1/verification/queue",
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_get_verification_queue_forbidden_for_regular_user(
    client: AsyncClient,
    regular_user: User,
):
    """Regular user receives 403 when accessing the verification queue."""
    response = await client.get(
        "/v1/verification/queue",
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_verification_queue_requires_auth(client: AsyncClient):
    """Unauthenticated request to the verification queue returns 401."""
    response = await client.get("/v1/verification/queue")

    assert response.status_code == 401, response.text


@pytest.mark.asyncio
async def test_verify_post_approved(
    client: AsyncClient,
    verifier_user: User,
    submitted_post: Post,
):
    """Verifier can approve a submitted post; status becomes active and a case is created."""
    payload = {
        "remarks": "All evidence verified. Post is legitimate.",
    }

    response = await client.post(
        f"/v1/verification/{submitted_post.id}/verify",
        json=payload,
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["post_id"] == str(submitted_post.id)
    assert data["decision"] == VerificationDecision.VERIFIED.value
    assert data["new_status"] == "active"
    assert data["case_id"] is not None
    assert data["remarks"] == payload["remarks"]
    assert data["actioned_at"] is not None


@pytest.mark.asyncio
async def test_verify_post_request_more_info(
    client: AsyncClient,
    verifier_user: User,
    submitted_post: Post,
):
    """Verifier can request additional information; post status becomes needs_info."""
    payload = {
        "remarks": "Please provide supporting documents for the claim.",
    }

    response = await client.post(
        f"/v1/verification/{submitted_post.id}/request-info",
        json=payload,
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["post_id"] == str(submitted_post.id)
    assert data["decision"] == VerificationDecision.NEEDS_INFO.value
    assert data["new_status"] == "needs_info"
    assert data["case_id"] is None


@pytest.mark.asyncio
async def test_verify_post_rejected(
    client: AsyncClient,
    verifier_user: User,
    submitted_post: Post,
):
    """Verifier can reject a submitted post; post status becomes rejected."""
    payload = {
        "remarks": "The request does not meet the platform guidelines.",
    }

    response = await client.post(
        f"/v1/verification/{submitted_post.id}/reject",
        json=payload,
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["post_id"] == str(submitted_post.id)
    assert data["decision"] == VerificationDecision.REJECTED.value
    assert data["new_status"] == "rejected"
    assert data["case_id"] is None


@pytest.mark.asyncio
async def test_verify_post_requires_auth(
    client: AsyncClient,
    submitted_post: Post,
):
    """Unauthenticated request to verify a post returns 401."""
    payload = {"remarks": "Looks good."}

    response = await client.post(
        f"/v1/verification/{submitted_post.id}/verify",
        json=payload,
    )

    assert response.status_code == 401, response.text


@pytest.mark.asyncio
async def test_verify_post_forbidden_for_regular_user(
    client: AsyncClient,
    regular_user: User,
    submitted_post: Post,
):
    """Regular user (no verifier role) receives 403 when trying to verify a post."""
    payload = {"remarks": "I think this is fine."}

    response = await client.post(
        f"/v1/verification/{submitted_post.id}/verify",
        json=payload,
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_verify_nonexistent_post(
    client: AsyncClient,
    verifier_user: User,
):
    """Verifying a post that does not exist returns 404."""
    from uuid import uuid4

    payload = {"remarks": "Looks good."}

    response = await client.post(
        f"/v1/verification/{uuid4()}/verify",
        json=payload,
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 404, response.text


@pytest.mark.asyncio
async def test_verify_post_invalid_state(
    client: AsyncClient,
    db_session: AsyncSession,
    verifier_user: User,
    post_author: User,
):
    """Attempting to verify a post that is not in SUBMITTED/NEEDS_INFO state returns 409."""
    # Create a post that is already in ACTIVE state (already verified).
    active_post = Post(
        author_id=post_author.id,
        title="Already active post",
        description="This post has already been verified and is active.",
        category=PostCategory.MENTORSHIP.value,
        urgency=PostUrgency.NORMAL.value,
        city="Mumbai",
        status=PostStatus.ACTIVE.value,
    )
    db_session.add(active_post)
    await db_session.commit()
    await db_session.refresh(active_post)

    payload = {"remarks": "Trying to re-verify an active post."}

    response = await client.post(
        f"/v1/verification/{active_post.id}/verify",
        json=payload,
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 409, response.text


@pytest.mark.asyncio
async def test_verify_post_short_remarks_rejected(
    client: AsyncClient,
    verifier_user: User,
    submitted_post: Post,
):
    """Remarks shorter than 5 characters fail Pydantic validation (422)."""
    payload = {"remarks": "ok"}

    response = await client.post(
        f"/v1/verification/{submitted_post.id}/verify",
        json=payload,
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_verify_post_second_decision_after_needs_info(
    client: AsyncClient,
    db_session: AsyncSession,
    verifier_user: User,
    post_author: User,
):
    """Post in NEEDS_INFO state can be verified on a second round."""
    post = Post(
        author_id=post_author.id,
        title="Follow-up post",
        description="I have provided the requested documents.",
        category=PostCategory.NAVIGATION.value,
        urgency=PostUrgency.NORMAL.value,
        city="Chennai",
        status=PostStatus.NEEDS_INFO.value,
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)

    payload = {"remarks": "Documents reviewed and verified successfully."}

    response = await client.post(
        f"/v1/verification/{post.id}/verify",
        json=payload,
        headers=_auth_headers(verifier_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["decision"] == VerificationDecision.VERIFIED.value
    assert data["new_status"] == "active"
    assert data["case_id"] is not None
