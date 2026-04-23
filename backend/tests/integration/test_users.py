"""Integration tests for the users module."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite import InviteCode
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
    name: str = "Users Test User",
    city: str = "Mumbai",
) -> tuple[str, str]:
    """Full auth flow. Returns (access_token, user_id)."""
    signup_data = {
        "name": name,
        "phone": phone,
        "email": email,
        "city": city,
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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def user_invite(db_session: AsyncSession) -> InviteCode:
    return await _create_invite(db_session, "USER-INVITE-001")


@pytest.fixture
async def user2_invite(db_session: AsyncSession) -> InviteCode:
    return await _create_invite(db_session, "USER-INVITE-002")


@pytest.fixture
async def auth_token_and_id(
    client: AsyncClient,
    db_session: AsyncSession,
    user_invite: InviteCode,
) -> tuple[str, str]:
    return await _signup_and_login(
        client, db_session, user_invite.code,
        phone="+919822000001",
        email="userstest1@example.com",
        name="Primary Test User",
        city="Mumbai",
    )


@pytest.fixture
async def auth_headers(auth_token_and_id: tuple[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token_and_id[0]}"}


@pytest.fixture
async def current_user_id(auth_token_and_id: tuple[str, str]) -> str:
    return auth_token_and_id[1]


@pytest.fixture
async def second_user_token_and_id(
    client: AsyncClient,
    db_session: AsyncSession,
    user2_invite: InviteCode,
) -> tuple[str, str]:
    return await _signup_and_login(
        client, db_session, user2_invite.code,
        phone="+919822000002",
        email="userstest2@example.com",
        name="Secondary Test User",
        city="Delhi",
    )


@pytest.fixture
async def second_auth_headers(second_user_token_and_id: tuple[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {second_user_token_and_id[0]}"}


@pytest.fixture
async def second_user_id(second_user_token_and_id: tuple[str, str]) -> str:
    return second_user_token_and_id[1]


# ---------------------------------------------------------------------------
# GET /v1/users/me
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_my_profile(client: AsyncClient, auth_headers: dict[str, str], current_user_id: str):
    """GET /v1/users/me returns the authenticated user's full profile."""
    resp = await client.get("/v1/users/me", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == current_user_id
    assert data["name"] == "Primary Test User"
    assert data["email"] == "userstest1@example.com"
    assert data["phone"] == "+919822000001"
    assert data["city"] == "Mumbai"
    assert "roles" in data
    assert "verification_level" in data
    assert "phone_verified" in data
    assert "email_verified" in data
    assert "is_active" in data
    assert "skills" in data
    assert "privacy_settings" in data


@pytest.mark.asyncio
async def test_get_my_profile_unauthenticated(client: AsyncClient):
    """GET /v1/users/me without token returns 401."""
    resp = await client.get("/v1/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_my_profile_verification_levels(
    client: AsyncClient,
    auth_headers: dict[str, str],
):
    """GET /v1/users/me reflects phone_verified and email_verified flags after full OTP flow."""
    resp = await client.get("/v1/users/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # The fixture performed both phone and email OTP verification
    assert data["phone_verified"] is True
    assert data["email_verified"] is True


# ---------------------------------------------------------------------------
# PATCH /v1/users/me
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_my_profile(client: AsyncClient, auth_headers: dict[str, str]):
    """PATCH /v1/users/me updates name, city, and bio."""
    update_data = {
        "name": "Updated Name Here",
        "city": "Bangalore",
        "bio": "I am a helpful volunteer in Bangalore.",
    }
    resp = await client.patch("/v1/users/me", json=update_data, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name Here"
    assert data["city"] == "Bangalore"
    assert data["bio"] == "I am a helpful volunteer in Bangalore."


@pytest.mark.asyncio
async def test_update_my_profile_partial(client: AsyncClient, auth_headers: dict[str, str]):
    """PATCH /v1/users/me with only bio set leaves other fields unchanged."""
    resp = await client.patch("/v1/users/me", json={"bio": "Just a bio update."}, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["bio"] == "Just a bio update."
    # Name and city remain as set during signup
    assert data["name"] == "Primary Test User"
    assert data["city"] == "Mumbai"


@pytest.mark.asyncio
async def test_update_my_profile_unauthenticated(client: AsyncClient):
    """PATCH /v1/users/me without a token returns 401."""
    resp = await client.patch("/v1/users/me", json={"bio": "Sneaky update"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_my_profile_name_too_short(client: AsyncClient, auth_headers: dict[str, str]):
    """PATCH /v1/users/me with a name shorter than 2 chars returns 422."""
    resp = await client.patch("/v1/users/me", json={"name": "X"}, headers=auth_headers)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /v1/users/me/skills
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_add_skill(client: AsyncClient, auth_headers: dict[str, str]):
    """POST /v1/users/me/skills adds a skill to the user's profile."""
    resp = await client.post(
        "/v1/users/me/skills",
        json={"skill": "Python programming"},
        headers=auth_headers,
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["skill"] == "Python programming"
    assert "id" in data


@pytest.mark.asyncio
async def test_add_skill_appears_in_profile(client: AsyncClient, auth_headers: dict[str, str]):
    """Skill added via POST /v1/users/me/skills appears when GET /v1/users/me is called."""
    await client.post(
        "/v1/users/me/skills",
        json={"skill": "First aid"},
        headers=auth_headers,
    )

    resp = await client.get("/v1/users/me", headers=auth_headers)
    assert resp.status_code == 200
    assert "First aid" in resp.json()["skills"]


@pytest.mark.asyncio
async def test_add_duplicate_skill(client: AsyncClient, auth_headers: dict[str, str]):
    """POST /v1/users/me/skills with a skill that already exists returns 409."""
    await client.post("/v1/users/me/skills", json={"skill": "Cooking"}, headers=auth_headers)
    resp = await client.post("/v1/users/me/skills", json={"skill": "Cooking"}, headers=auth_headers)

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DUPLICATE"


@pytest.mark.asyncio
async def test_add_skill_unauthenticated(client: AsyncClient):
    """POST /v1/users/me/skills without token returns 401."""
    resp = await client.post("/v1/users/me/skills", json={"skill": "Swimming"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /v1/users/me/skills/{skill_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_remove_skill(client: AsyncClient, auth_headers: dict[str, str]):
    """DELETE /v1/users/me/skills/{skill_id} removes the skill."""
    # First add a skill
    add_resp = await client.post(
        "/v1/users/me/skills",
        json={"skill": "Driving"},
        headers=auth_headers,
    )
    assert add_resp.status_code == 201
    skill_id = add_resp.json()["id"]

    # Now remove it
    resp = await client.delete(f"/v1/users/me/skills/{skill_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Verify it no longer appears in profile
    profile_resp = await client.get("/v1/users/me", headers=auth_headers)
    assert "Driving" not in profile_resp.json()["skills"]


@pytest.mark.asyncio
async def test_remove_skill_not_found(client: AsyncClient, auth_headers: dict[str, str]):
    """DELETE /v1/users/me/skills/{nonexistent_id} returns 404."""
    random_id = str(uuid4())
    resp = await client.delete(f"/v1/users/me/skills/{random_id}", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_remove_skill_belonging_to_another_user(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_auth_headers: dict[str, str],
):
    """DELETE /v1/users/me/skills/{skill_id} returns 404 when the skill belongs to another user."""
    # User 1 adds a skill
    add_resp = await client.post(
        "/v1/users/me/skills",
        json={"skill": "Legal advice"},
        headers=auth_headers,
    )
    assert add_resp.status_code == 201
    skill_id = add_resp.json()["id"]

    # User 2 attempts to delete user 1's skill
    resp = await client.delete(f"/v1/users/me/skills/{skill_id}", headers=second_auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /v1/users/me/privacy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_privacy(client: AsyncClient, auth_headers: dict[str, str]):
    """PATCH /v1/users/me/privacy updates privacy settings."""
    update_data = {
        "show_email": True,
        "show_phone": False,
        "show_full_city": True,
    }
    resp = await client.patch("/v1/users/me/privacy", json=update_data, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["show_email"] is True
    assert data["show_phone"] is False
    assert data["show_full_city"] is True


@pytest.mark.asyncio
async def test_update_privacy_partial(client: AsyncClient, auth_headers: dict[str, str]):
    """PATCH /v1/users/me/privacy with a partial body only changes supplied fields."""
    # Turn show_email on
    await client.patch("/v1/users/me/privacy", json={"show_email": True}, headers=auth_headers)

    # Now turn show_phone on (show_email should remain True)
    resp = await client.patch("/v1/users/me/privacy", json={"show_phone": True}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["show_email"] is True
    assert data["show_phone"] is True


@pytest.mark.asyncio
async def test_update_privacy_unauthenticated(client: AsyncClient):
    """PATCH /v1/users/me/privacy without token returns 401."""
    resp = await client.patch("/v1/users/me/privacy", json={"show_email": True})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /v1/users/{user_id} — public profile
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_public_profile(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_user_id: str,
):
    """GET /v1/users/{id} returns the public profile of another user."""
    resp = await client.get(f"/v1/users/{second_user_id}", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == second_user_id
    assert data["name"] == "Secondary Test User"
    assert "roles" in data
    assert "verification_level" in data
    assert "skills" in data
    # Private fields should not be present
    assert "phone_verified" not in data
    assert "email_verified" not in data
    assert "is_active" not in data
    assert "privacy_settings" not in data


@pytest.mark.asyncio
async def test_get_public_profile_unauthenticated(client: AsyncClient, second_user_id: str):
    """GET /v1/users/{id} without token returns 401."""
    resp = await client.get(f"/v1/users/{second_user_id}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_public_profile_not_found(client: AsyncClient, auth_headers: dict[str, str]):
    """GET /v1/users/{nonexistent_id} returns 404."""
    random_id = str(uuid4())
    resp = await client.get(f"/v1/users/{random_id}", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_get_public_profile_email_hidden_by_default(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_user_id: str,
):
    """GET /v1/users/{id} hides email when show_email privacy setting is False (default)."""
    # Default privacy has show_email=False
    resp = await client.get(f"/v1/users/{second_user_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json().get("email") is None


@pytest.mark.asyncio
async def test_get_public_profile_email_visible_when_enabled(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_auth_headers: dict[str, str],
    second_user_id: str,
):
    """GET /v1/users/{id} exposes email when the user sets show_email=True."""
    # User 2 enables email visibility
    privacy_resp = await client.patch(
        "/v1/users/me/privacy",
        json={"show_email": True},
        headers=second_auth_headers,
    )
    assert privacy_resp.status_code == 200

    # User 1 views user 2's profile
    resp = await client.get(f"/v1/users/{second_user_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json().get("email") == "userstest2@example.com"


@pytest.mark.asyncio
async def test_get_own_public_profile(
    client: AsyncClient,
    auth_headers: dict[str, str],
    current_user_id: str,
):
    """GET /v1/users/{own_id} works and returns the public view of one's own profile."""
    resp = await client.get(f"/v1/users/{current_user_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == current_user_id
    assert data["name"] == "Primary Test User"
