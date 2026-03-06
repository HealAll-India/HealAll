"""Integration tests for the case lifecycle endpoints."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import Case, CaseStatus
from app.models.invite import InviteCode
from app.models.post import Post, PostStatus
from app.models.user import User


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
) -> dict[str, str]:
    """
    Sign up a user, verify phone + email OTPs, then log in.
    Returns headers dict {"Authorization": "Bearer <token>"}.
    """
    from app.services.auth_service import create_otp

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
    assert resp.status_code == 201, resp.text

    phone_otp, _ = await create_otp(db_session, phone, "signup")
    resp = await client.post(
        "/v1/auth/verify-otp",
        json={"phone_or_email": phone, "otp_code": phone_otp},
    )
    assert resp.status_code == 200, resp.text

    email_otp, _ = await create_otp(db_session, email, "signup")
    resp = await client.post(
        "/v1/auth/verify-otp",
        json={"phone_or_email": email, "otp_code": email_otp},
    )
    assert resp.status_code == 200, resp.text

    login_otp, _ = await create_otp(db_session, phone, "login")
    resp = await client.post(
        "/v1/auth/token",
        json={"phone_or_email": phone, "otp_code": login_otp},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def invite_code(db_session: AsyncSession) -> InviteCode:
    invite = InviteCode(
        code="CASE-INVITE-001",
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
async def seeker_headers(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: InviteCode,
) -> dict[str, str]:
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Help Seeker",
        phone="+919000000001",
        email="seeker@example.com",
    )


@pytest.fixture
async def helper_headers(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: InviteCode,
) -> dict[str, str]:
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Helper User",
        phone="+919000000002",
        email="helper@example.com",
    )


@pytest.fixture
async def other_user_headers(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: InviteCode,
) -> dict[str, str]:
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Other User",
        phone="+919000000003",
        email="other@example.com",
    )


async def _seed_case(db_session: AsyncSession, author_id) -> tuple[Post, Case]:
    """Create an active post and a linked case owned by author_id."""
    post = Post(
        author_id=author_id,
        title="I need help with mental health support",
        description="Detailed description of the request for help.",
        category="emotional_support",
        urgency="normal",
        city="Mumbai",
        status=PostStatus.ACTIVE.value,
    )
    db_session.add(post)
    await db_session.flush()

    case = Case(
        post_id=post.id,
        status=CaseStatus.ACTIVE.value,
    )
    db_session.add(case)
    await db_session.commit()
    await db_session.refresh(post)
    await db_session.refresh(case)
    return post, case


async def _get_seeker_user_id(db_session: AsyncSession) -> object:
    from sqlalchemy import select
    from app.models.user import User as UserModel
    result = await db_session.execute(
        select(UserModel).where(UserModel.phone == "+919000000001")
    )
    return result.scalar_one().id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_case_from_post(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
):
    """A case seeded in the DB is visible and linked to its post."""
    seeker_id = await _get_seeker_user_id(db_session)
    post, case = await _seed_case(db_session, seeker_id)

    resp = await client.get(f"/v1/cases/{case.id}", headers=seeker_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(case.id)
    assert data["post"]["id"] == str(post.id)
    assert data["status"] == CaseStatus.ACTIVE.value


@pytest.mark.asyncio
async def test_list_my_cases(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
):
    """GET /v1/cases returns only cases the current user is involved in."""
    seeker_id = await _get_seeker_user_id(db_session)
    _post, case = await _seed_case(db_session, seeker_id)

    resp = await client.get("/v1/cases", headers=seeker_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] >= 1
    case_ids = [item["id"] for item in data["items"]]
    assert str(case.id) in case_ids


@pytest.mark.asyncio
async def test_get_case_by_id(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
):
    """GET /v1/cases/{id} returns full case detail for authorised user."""
    seeker_id = await _get_seeker_user_id(db_session)
    post, case = await _seed_case(db_session, seeker_id)

    resp = await client.get(f"/v1/cases/{case.id}", headers=seeker_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(case.id)
    assert data["post"]["title"] == post.title
    assert data["post"]["author_id"] == str(seeker_id)
    assert data["helper_count"] == 0
    assert data["owner"] is None


@pytest.mark.asyncio
async def test_add_case_helper(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
    helper_headers: dict[str, str],
):
    """POST /v1/cases/{id}/helpers adds the current user as an active helper."""
    seeker_id = await _get_seeker_user_id(db_session)
    _post, case = await _seed_case(db_session, seeker_id)

    resp = await client.post(
        f"/v1/cases/{case.id}/helpers", headers=helper_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["case_id"] == str(case.id)
    assert data["status"] == "active"

    # Helper count should now be 1
    detail = await client.get(f"/v1/cases/{case.id}", headers=helper_headers)
    assert detail.status_code == 200
    assert detail.json()["helper_count"] == 1


@pytest.mark.asyncio
async def test_add_case_note(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
):
    """POST /v1/cases/{id}/notes adds a note for a case team member."""
    seeker_id = await _get_seeker_user_id(db_session)
    _post, case = await _seed_case(db_session, seeker_id)

    payload = {
        "body": "First progress note for this case.",
        "support_type": "emotional",
        "hours_contributed": 1.5,
    }
    resp = await client.post(
        f"/v1/cases/{case.id}/notes", json=payload, headers=seeker_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["body"] == payload["body"]
    assert data["support_type"] == "emotional"
    assert data["hours_contributed"] == 1.5
    assert data["case_id"] == str(case.id)
    assert "author" in data


@pytest.mark.asyncio
async def test_list_case_notes(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
):
    """GET /v1/cases/{id}/notes returns all notes for a team member."""
    seeker_id = await _get_seeker_user_id(db_session)
    _post, case = await _seed_case(db_session, seeker_id)

    # Add two notes
    for i in range(2):
        await client.post(
            f"/v1/cases/{case.id}/notes",
            json={"body": f"Note number {i + 1} for the case."},
            headers=seeker_headers,
        )

    resp = await client.get(f"/v1/cases/{case.id}/notes", headers=seeker_headers)
    assert resp.status_code == 200
    notes = resp.json()
    assert isinstance(notes, list)
    assert len(notes) == 2


@pytest.mark.asyncio
async def test_update_case_status(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
):
    """POST /v1/cases/{id}/close transitions status when requester is post author."""
    seeker_id = await _get_seeker_user_id(db_session)
    _post, case = await _seed_case(db_session, seeker_id)

    payload = {
        "resolution_type": "resolved",
        "closure_remarks": "The issue has been fully resolved.",
        "impact_consent": False,
    }
    resp = await client.post(
        f"/v1/cases/{case.id}/close", json=payload, headers=seeker_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    # Post author is not a verifier so this becomes a closure request
    assert data["case_id"] == str(case.id)
    assert data["resolution_type"] == "resolved"

    # Confirm the case status updated
    detail = await client.get(f"/v1/cases/{case.id}", headers=seeker_headers)
    assert detail.json()["status"] == CaseStatus.CLOSURE_REQUESTED.value


@pytest.mark.asyncio
async def test_case_not_found(
    client: AsyncClient,
    seeker_headers: dict[str, str],
):
    """GET /v1/cases/<non-existent-id> returns 404."""
    fake_id = uuid4()
    resp = await client.get(f"/v1/cases/{fake_id}", headers=seeker_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_case_unauthorized(
    client: AsyncClient,
    db_session: AsyncSession,
    seeker_headers: dict[str, str],
    other_user_headers: dict[str, str],
):
    """A user with no involvement in a case cannot access it (403)."""
    seeker_id = await _get_seeker_user_id(db_session)
    _post, case = await _seed_case(db_session, seeker_id)

    resp = await client.get(f"/v1/cases/{case.id}", headers=other_user_headers)
    assert resp.status_code == 403
