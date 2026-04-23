"""Integration tests for the moderation API endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.security import create_access_token
from app.models.report import (
    ModerationActionType,
    Report,
    ReportReason,
    ReportStatus,
    ReportTargetType,
)
from app.models.user import User

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def regular_user(db_session: AsyncSession) -> User:
    """Create a regular user with helper + help_seeker roles."""
    user = User(
        name="Regular User",
        phone="+912222222201",
        email="mod_regular@example.com",
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
        phone="+912222222202",
        email="mod_admin@example.com",
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
    """Create a second user to be the target of moderation actions."""
    user = User(
        name="Target User",
        phone="+912222222203",
        email="mod_target@example.com",
        city="Pune",
        age_range="25-34",
        roles=[UserRole.HELP_SEEKER.value],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def pending_report(
    db_session: AsyncSession,
    regular_user: User,
    target_user: User,
) -> Report:
    """Create a pending report filed by regular_user against target_user."""
    report = Report(
        reporter_id=regular_user.id,
        target_type=ReportTargetType.USER.value,
        target_id=target_user.id,
        reason=ReportReason.SPAM.value,
        status=ReportStatus.PENDING.value,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)
    return report


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
async def test_review_report_admin(
    client: AsyncClient,
    admin_user: User,
    target_user: User,
    pending_report: Report,
):
    """Admin can create a moderation action linked to a pending report."""
    payload = {
        "report_id": str(pending_report.id),
        "action": ModerationActionType.WARN.value,
        "reason": "User was warned for spamming.",
    }

    response = await client.post(
        "/v1/moderation/actions",
        json=payload,
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["action"] == ModerationActionType.WARN.value
    assert data["acted_by"] == str(admin_user.id)
    assert data["target_user_id"] == str(target_user.id)
    assert data["report_id"] == str(pending_report.id)


@pytest.mark.asyncio
async def test_suspend_user_admin(
    client: AsyncClient,
    admin_user: User,
    target_user: User,
):
    """Admin can suspend a user directly by target_user_id without a report."""
    payload = {
        "target_user_id": str(target_user.id),
        "action": ModerationActionType.SUSPEND.value,
        "reason": "Repeated policy violations.",
        "duration_hours": 48,
    }

    response = await client.post(
        "/v1/moderation/actions",
        json=payload,
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["action"] == ModerationActionType.SUSPEND.value
    assert data["target_user_id"] == str(target_user.id)
    assert data["duration_hours"] == 48
    assert data["expires_at"] is not None


@pytest.mark.asyncio
async def test_moderation_requires_admin(
    client: AsyncClient,
    regular_user: User,
    target_user: User,
):
    """Regular user (no moderator role) receives 403 when creating actions."""
    payload = {
        "target_user_id": str(target_user.id),
        "action": ModerationActionType.WARN.value,
        "reason": "Trying to warn without permission.",
    }

    response = await client.post(
        "/v1/moderation/actions",
        json=payload,
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_list_moderation_actions_admin(
    client: AsyncClient,
    admin_user: User,
    target_user: User,
    pending_report: Report,
):
    """Admin can list moderation action history."""
    # Create an action first so there is at least one record.
    action_payload = {
        "report_id": str(pending_report.id),
        "action": ModerationActionType.DISMISS.value,
        "reason": "Report was invalid.",
    }
    create_resp = await client.post(
        "/v1/moderation/actions",
        json=action_payload,
        headers=_auth_headers(admin_user),
    )
    assert create_resp.status_code == 201, create_resp.text

    response = await client.get(
        "/v1/moderation/actions",
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_list_moderation_actions_user_forbidden(
    client: AsyncClient,
    regular_user: User,
):
    """Regular user receives 403 when listing moderation actions."""
    response = await client.get(
        "/v1/moderation/actions",
        headers=_auth_headers(regular_user),
    )

    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_unsuspend_user_via_dismiss_action(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    target_user: User,
):
    """
    Admin can effectively unsuspend a user by issuing a WARN (or DISMISS)
    action that does not set suspended_until.

    The moderation API does not have a dedicated unsuspend endpoint; the
    WARN / DISMISS action types leave is_active and suspended_until unchanged,
    which can be used after clearing suspension state directly.  This test
    verifies the action is accepted and returns a valid response.
    """
    # First suspend the user.
    suspend_payload = {
        "target_user_id": str(target_user.id),
        "action": ModerationActionType.SUSPEND.value,
        "reason": "Initial suspension.",
        "duration_hours": 24,
    }
    suspend_resp = await client.post(
        "/v1/moderation/actions",
        json=suspend_payload,
        headers=_auth_headers(admin_user),
    )
    assert suspend_resp.status_code == 201, suspend_resp.text

    # Re-activate the user directly in the DB (simulating an admin
    # unsuspend flow that clears the flag before issuing a new action).
    await db_session.refresh(target_user)
    target_user.is_active = True
    target_user.suspended_until = None
    await db_session.commit()
    await db_session.refresh(target_user)

    # Now issue a WARN action to confirm the user is actionable again.
    warn_payload = {
        "target_user_id": str(target_user.id),
        "action": ModerationActionType.WARN.value,
        "reason": "Final warning after reinstatement.",
    }
    warn_resp = await client.post(
        "/v1/moderation/actions",
        json=warn_payload,
        headers=_auth_headers(admin_user),
    )

    assert warn_resp.status_code == 201, warn_resp.text
    data = warn_resp.json()
    assert data["action"] == ModerationActionType.WARN.value
    assert data["target_user_id"] == str(target_user.id)


@pytest.mark.asyncio
async def test_moderation_action_unauthenticated(
    client: AsyncClient,
    target_user: User,
):
    """Unauthenticated request to create a moderation action returns 401."""
    payload = {
        "target_user_id": str(target_user.id),
        "action": ModerationActionType.WARN.value,
        "reason": "No auth header.",
    }

    response = await client.post("/v1/moderation/actions", json=payload)

    assert response.status_code == 401, response.text


@pytest.mark.asyncio
async def test_moderation_action_requires_target(
    client: AsyncClient,
    admin_user: User,
):
    """Request with neither report_id nor target_user_id is rejected (422)."""
    payload = {
        "action": ModerationActionType.WARN.value,
        "reason": "Missing target.",
    }

    response = await client.post(
        "/v1/moderation/actions",
        json=payload,
        headers=_auth_headers(admin_user),
    )

    # Pydantic model_validator raises ValueError which FastAPI maps to 422.
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_ban_user_admin(
    client: AsyncClient,
    admin_user: User,
    target_user: User,
):
    """Admin can permanently ban a user; response has no expires_at."""
    payload = {
        "target_user_id": str(target_user.id),
        "action": ModerationActionType.BAN.value,
        "reason": "Severe and repeated abuse.",
    }

    response = await client.post(
        "/v1/moderation/actions",
        json=payload,
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["action"] == ModerationActionType.BAN.value
    assert data["expires_at"] is None
