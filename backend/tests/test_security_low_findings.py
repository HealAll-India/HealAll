"""Low-severity hardening: OTP sends, signup answers, invites, avatars, /metrics, deps."""

import re
import tomllib
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ExpiredException
from app.models.invite import InviteCode
from app.models.user import User
from app.services import invite_service, notification_service, upload_service
from app.services.auth_service import create_otp

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def sent_emails(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    sent: list[str] = []

    async def fake_send(email: str, otp_code: str, purpose: str = "verification") -> None:
        sent.append(email)

    monkeypatch.setattr(notification_service, "send_otp_email", fake_send)
    return sent


async def _member(db: AsyncSession, email: str = "member@example.com") -> User:
    user = User(name="Member", phone="+919811100002", email=email, city="Delhi", age_range="25-34", roles=["helper"])
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _invite(db: AsyncSession, max_uses: int = 1) -> InviteCode:
    invite = InviteCode(
        code=f"LOW-{uuid4().hex[:8]}",
        created_by=uuid4(),
        max_uses=max_uses,
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    db.add(invite)
    await db.commit()
    return invite


async def test_resend_otp_to_unknown_address_sends_nothing(client: AsyncClient, sent_emails: list[str]):
    resp = await client.post("/v1/auth/resend-otp", json={"phone_or_email": "stranger@example.com"})
    assert resp.status_code == 200
    assert resp.json()["message"] == "OTP sent to email"
    assert sent_emails == []


async def test_resend_otp_to_member_sends(client: AsyncClient, db_session: AsyncSession, sent_emails: list[str]):
    await _member(db_session)
    resp = await client.post("/v1/auth/resend-otp", json={"phone_or_email": "member@example.com"})
    assert resp.status_code == 200
    assert resp.json()["message"] == "OTP sent to email"
    assert sent_emails == ["member@example.com"]


async def test_signup_needs_a_valid_invite_even_for_existing_email(
    client: AsyncClient, db_session: AsyncSession, sent_emails: list[str]
):
    await _member(db_session)
    resp = await client.post(
        "/v1/auth/signup",
        json={
            "name": "Prober",
            "phone": "+919811100099",
            "email": "member@example.com",
            "city": "Delhi",
            "age_range": "25-34",
            "invite_code": "NOT-A-CODE",
            "roles": ["helper"],
        },
    )
    assert resp.status_code == 404
    assert sent_emails == []


async def test_invite_last_use_cannot_be_taken_twice(db_session: AsyncSession):
    invite = await _invite(db_session, max_uses=1)
    await invite_service.validate_and_use_invite(db_session, invite.code)
    with pytest.raises(ExpiredException):
        await invite_service.validate_and_use_invite(db_session, invite.code)
    await db_session.refresh(invite)
    assert invite.use_count == 1


async def _login(client: AsyncClient, db: AsyncSession, user: User) -> dict[str, str]:
    otp, _ = await create_otp(db, user.email, "login")
    await db.commit()
    resp = await client.post("/v1/auth/token", json={"phone_or_email": user.email, "otp_code": otp})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def test_avatar_must_be_our_own_upload(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    user = await _member(db_session)
    headers = await _login(client, db_session, user)

    bad = await client.patch("/v1/users/me", json={"avatar_url": "https://evil.example/pixel.gif"}, headers=headers)
    assert bad.status_code == 422

    other = upload_service.public_object_url(get_settings().S3_BUCKET_MEDIA, f"profile-photos/{uuid4()}/a.jpg")
    assert (await client.patch("/v1/users/me", json={"avatar_url": other}, headers=headers)).status_code == 422

    own = upload_service.public_object_url(get_settings().S3_BUCKET_MEDIA, f"profile-photos/{user.id}/a.jpg")
    ok = await client.patch("/v1/users/me", json={"avatar_url": own}, headers=headers)
    assert ok.status_code == 200
    assert ok.json()["avatar_url"] == own

    cleared = await client.patch("/v1/users/me", json={"avatar_url": ""}, headers=headers)
    assert cleared.status_code == 200


async def test_metrics_needs_the_token_when_one_is_set(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(get_settings(), "METRICS_TOKEN", "s3cret")
    assert (await client.get("/metrics")).status_code == 404
    assert (await client.get("/metrics", headers={"Authorization": "Bearer wrong"})).status_code == 404
    assert (await client.get("/metrics", headers={"Authorization": "Bearer s3cret"})).status_code == 200


async def test_metrics_is_off_in_production_without_a_token(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(get_settings(), "METRICS_TOKEN", None)
    monkeypatch.setattr(get_settings(), "APP_ENV", "production")
    assert (await client.get("/metrics")).status_code == 404


def test_requirements_txt_covers_pyproject():
    """Railway installs requirements.txt; a missing runtime dep crashes the API on boot."""

    def name(spec: str) -> str:
        return re.split(r"[\[<>=!~ ;]", spec.strip(), maxsplit=1)[0].lower()

    deps = tomllib.loads((BACKEND / "pyproject.toml").read_text())["project"]["dependencies"]
    lines = (BACKEND / "requirements.txt").read_text().splitlines()
    listed = {name(line) for line in lines if line.strip() and not line.startswith("#")}
    assert {name(d) for d in deps} - listed == set()
