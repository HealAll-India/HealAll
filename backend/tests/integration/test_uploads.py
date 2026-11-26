"""Integration tests for the presigned upload endpoints."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite import InviteCode
from app.models.post import PostCategory, PostUrgency
from app.services.auth_service import create_otp

_PHOTO = {"file_name": "me.png", "content_type": "image/png", "size_bytes": 2048}

_VALID_POST = {
    "title": "Need help with groceries",
    "description": "I am unable to go out and need someone to buy groceries for me this week.",
    "category": PostCategory.ON_GROUND.value,
    "urgency": PostUrgency.NORMAL.value,
    "city": "Mumbai",
    "address": "Near Bandra West Market",
    "pincode": "400050",
}


async def _token(client: AsyncClient, db: AsyncSession, code: str, phone: str, email: str) -> str:
    db.add(
        InviteCode(
            code=code,
            created_by=uuid4(),
            max_uses=10,
            use_count=0,
            expires_at=datetime.now(UTC) + timedelta(days=30),
            revoked=False,
        )
    )
    await db.commit()
    resp = await client.post(
        "/v1/auth/signup",
        json={
            "name": "Upload Test User",
            "phone": phone,
            "email": email,
            "city": "Mumbai",
            "age_range": "18-24",
            "invite_code": code,
            "roles": ["helper", "help_seeker"],
        },
    )
    assert resp.status_code == 201, resp.text
    for ident in (phone, email):
        otp, _ = await create_otp(db, ident, "signup")
        resp = await client.post("/v1/auth/verify-otp", json={"phone_or_email": ident, "otp_code": otp})
        assert resp.status_code == 200, resp.text
    otp, _ = await create_otp(db, phone, "login")
    resp = await client.post("/v1/auth/token", json={"phone_or_email": phone, "otp_code": otp})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
async def owner_headers(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    token = await _token(client, db_session, "UPLOAD-INVITE-001", "+919800000101", "upload1@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def other_headers(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    token = await _token(client, db_session, "UPLOAD-INVITE-002", "+919800000102", "upload2@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_upload_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/v1/uploads/profile-photo", json=_PHOTO)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_profile_photo_returns_signed_url_and_safe_key(
    client: AsyncClient, owner_headers: dict[str, str]
) -> None:
    body = {**_PHOTO, "file_name": "../../evil.html"}
    resp = await client.post("/v1/uploads/profile-photo", json=body, headers=owner_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["object_key"].startswith("profile-photos/")
    assert data["object_key"].endswith(".png")
    assert ".." not in data["object_key"]
    assert data["public_url"]


@pytest.mark.asyncio
async def test_profile_photo_rejects_bad_type_and_size(client: AsyncClient, owner_headers: dict[str, str]) -> None:
    resp = await client.post(
        "/v1/uploads/profile-photo", json={**_PHOTO, "content_type": "text/html"}, headers=owner_headers
    )
    assert resp.status_code == 422
    resp = await client.post(
        "/v1/uploads/profile-photo", json={**_PHOTO, "size_bytes": 50 * 1024 * 1024}, headers=owner_headers
    )
    assert resp.status_code == 422
    resp = await client.post(
        "/v1/uploads/profile-photo",
        json={"file_name": "me.png", "content_type": "image/png"},
        headers=owner_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_post_attachment_only_for_own_post(
    client: AsyncClient, owner_headers: dict[str, str], other_headers: dict[str, str]
) -> None:
    resp = await client.post("/v1/posts", json=_VALID_POST, headers=owner_headers)
    assert resp.status_code == 201, resp.text
    post_id = resp.json()["id"]

    resp = await client.post(f"/v1/uploads/post-attachment?post_id={post_id}", json=_PHOTO, headers=owner_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["object_key"].startswith(f"post-attachments/{post_id}/")
    assert data["public_url"] is None

    resp = await client.post(f"/v1/uploads/post-attachment?post_id={post_id}", json=_PHOTO, headers=other_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_post_attachment_unknown_post(client: AsyncClient, owner_headers: dict[str, str]) -> None:
    resp = await client.post(f"/v1/uploads/post-attachment?post_id={uuid4()}", json=_PHOTO, headers=owner_headers)
    assert resp.status_code == 404
