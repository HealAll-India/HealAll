"""Integration tests for the reports API endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.security import create_access_token
from app.models.post import Post, PostCategory, PostStatus, PostUrgency
from app.models.report import Report, ReportReason, ReportStatus, ReportTargetType
from app.models.user import User

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def regular_user(db_session: AsyncSession) -> User:
    """Create a regular user with helper + help_seeker roles."""
    user = User(
        name="Regular User",
        phone="+911111111101",
        email="regular@example.com",
        city="Mumbai",
        age_range="18-24",
        roles=[UserRole.HELPER.value, UserRole.HELP_SEEKER.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user by directly setting the admin role in the DB."""
    user = User(
        name="Admin User",
        phone="+911111111102",
        email="admin@example.com",
        city="Delhi",
        age_range="25-34",
        roles=[UserRole.ADMIN.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def target_user(db_session: AsyncSession) -> User:
    """Create a second regular user to be the target of reports."""
    user = User(
        name="Target User",
        phone="+911111111103",
        email="target@example.com",
        city="Pune",
        age_range="25-34",
        roles=[UserRole.HELP_SEEKER.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def submitted_post(db_session: AsyncSession, target_user: User) -> Post:
    """Create a submitted post authored by target_user."""
    post = Post(
        author_id=target_user.id,
        title="Help needed with rent",
        description="I need urgent financial assistance for rent.",
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
async def test_report_post(
    client: AsyncClient,
    regular_user: User,
    submitted_post: Post,
):
    """Authenticated user can create a report against a post."""
    payload = {
        "target_type": ReportTargetType.POST.value,
        "target_id": str(submitted_post.id),
        "reason": ReportReason.SPAM.value,
        "description": "This post looks like spam.",
    }

    response = await client.post(
        "/v1/reports",
        json=payload,
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["target_type"] == ReportTargetType.POST.value
    assert data["target_id"] == str(submitted_post.id)
    assert data["reason"] == ReportReason.SPAM.value
    assert data["status"] == ReportStatus.PENDING.value
    assert data["reporter_id"] == str(regular_user.id)


@pytest.mark.asyncio
async def test_report_user(
    client: AsyncClient,
    regular_user: User,
    target_user: User,
):
    """Authenticated user can create a report against another user."""
    payload = {
        "target_type": ReportTargetType.USER.value,
        "target_id": str(target_user.id),
        "reason": ReportReason.HARASSMENT.value,
        "description": "This user is harassing me.",
    }

    response = await client.post(
        "/v1/reports",
        json=payload,
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["target_type"] == ReportTargetType.USER.value
    assert data["target_id"] == str(target_user.id)
    assert data["reason"] == ReportReason.HARASSMENT.value
    assert data["status"] == ReportStatus.PENDING.value


@pytest.mark.asyncio
async def test_report_duplicate(
    client: AsyncClient,
    regular_user: User,
    target_user: User,
):
    """Reporter cannot file a second report against the same target."""
    payload = {
        "target_type": ReportTargetType.USER.value,
        "target_id": str(target_user.id),
        "reason": ReportReason.FRAUD.value,
    }
    headers = _auth_headers(regular_user)

    first = await client.post("/v1/reports", json=payload, headers=headers)
    assert first.status_code == 201, first.text

    second = await client.post("/v1/reports", json=payload, headers=headers)
    assert second.status_code == 409, second.text


@pytest.mark.asyncio
async def test_list_reports_admin(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    regular_user: User,
    target_user: User,
):
    """Admin can list all reports (filtered to pending by default)."""
    # Seed one report directly so there is something to list.
    report = Report(
        reporter_id=regular_user.id,
        target_type=ReportTargetType.USER.value,
        target_id=target_user.id,
        reason=ReportReason.SPAM.value,
        status=ReportStatus.PENDING.value,
    )
    db_session.add(report)
    await db_session.commit()

    response = await client.get(
        "/v1/reports",
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert data["total"] >= 1
    assert all(item["status"] == ReportStatus.PENDING.value for item in data["items"])


@pytest.mark.asyncio
async def test_list_reports_user_forbidden(
    client: AsyncClient,
    regular_user: User,
):
    """Regular user (no moderator role) receives 403 when listing reports."""
    response = await client.get(
        "/v1/reports",
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_report_unauthenticated(
    client: AsyncClient,
    target_user: User,
):
    """Unauthenticated request to create a report returns 401."""
    payload = {
        "target_type": ReportTargetType.USER.value,
        "target_id": str(target_user.id),
        "reason": ReportReason.SPAM.value,
    }

    response = await client.post("/v1/reports", json=payload)

    assert response.status_code == 401, response.text


@pytest.mark.asyncio
async def test_report_nonexistent_target(
    client: AsyncClient,
    regular_user: User,
):
    """Reporting a target that does not exist returns 404."""
    payload = {
        "target_type": ReportTargetType.USER.value,
        "target_id": str(uuid4()),
        "reason": ReportReason.SPAM.value,
    }

    response = await client.post(
        "/v1/reports",
        json=payload,
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 404, response.text
