"""Integration tests for the consent-based messaging endpoints."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite import InviteCode
from app.models.message import Conversation, DMConsentRequest, DMConsentStatus
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
) -> tuple[dict[str, str], str]:
    """
    Sign up a user, verify OTPs, and log in.
    Returns (headers, user_id_str).
    """
    from app.services.auth_service import create_otp

    signup_data = {
        "name": name,
        "phone": phone,
        "email": email,
        "city": "Delhi",
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
        code="MSG-INVITE-001",
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
async def user_a(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: InviteCode,
) -> tuple[dict[str, str], str]:
    """Returns (auth_headers, user_id) for user A (the sender)."""
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Sender User",
        phone="+918000000001",
        email="sender@example.com",
    )


@pytest.fixture
async def user_b(
    client: AsyncClient,
    db_session: AsyncSession,
    invite_code: InviteCode,
) -> tuple[dict[str, str], str]:
    """Returns (auth_headers, user_id) for user B (the recipient)."""
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Recipient User",
        phone="+918000000002",
        email="recipient@example.com",
    )


async def _seed_post(db_session: AsyncSession, author_id) -> Post:
    """Create an active post for use as context in consent requests."""
    post = Post(
        author_id=author_id,
        title="Need emotional support",
        description="Looking for someone to talk to.",
        category="emotional_support",
        urgency="normal",
        city="Delhi",
        status=PostStatus.ACTIVE.value,
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


async def _get_user(db_session: AsyncSession, user_id: str) -> User:
    result = await db_session.execute(select(User).where(User.id == user_id))
    return result.scalar_one()


async def _setup_accepted_conversation(
    client: AsyncClient,
    db_session: AsyncSession,
    headers_a: dict,
    user_id_a: str,
    headers_b: dict,
    user_id_b: str,
) -> str:
    """
    Full flow: A requests consent -> B accepts -> returns conversation_id.
    """
    user_b_obj = await _get_user(db_session, user_id_b)

    consent_resp = await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id)},
        headers=headers_a,
    )
    assert consent_resp.status_code == 201, consent_resp.text
    request_id = consent_resp.json()["id"]

    accept_resp = await client.post(
        f"/v1/messages/consent/{request_id}/accept",
        headers=headers_b,
    )
    assert accept_resp.status_code == 200, accept_resp.text
    return accept_resp.json()["id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_request_dm_consent(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """POST /v1/messages/request-consent creates a pending consent request."""
    headers_a, user_id_a = user_a
    _headers_b, user_id_b = user_b

    user_b_obj = await _get_user(db_session, user_id_b)

    resp = await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id)},
        headers=headers_a,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["to_user_id"] == str(user_b_obj.id)
    assert data["from_user_id"] == user_id_a
    assert data["status"] == DMConsentStatus.PENDING.value
    assert data["post_id"] is None


@pytest.mark.asyncio
async def test_request_dm_consent_with_post(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """Consent request can be tied to an existing post."""
    headers_a, user_id_a = user_a
    _headers_b, user_id_b = user_b

    user_b_obj = await _get_user(db_session, user_id_b)
    post = await _seed_post(db_session, user_b_obj.id)

    resp = await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id), "post_id": str(post.id)},
        headers=headers_a,
    )
    assert resp.status_code == 201
    assert resp.json()["post_id"] == str(post.id)


@pytest.mark.asyncio
async def test_accept_consent_creates_conversation(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """POST /v1/messages/consent/{id}/accept opens a conversation."""
    headers_a, user_id_a = user_a
    headers_b, user_id_b = user_b

    user_b_obj = await _get_user(db_session, user_id_b)
    consent_resp = await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id)},
        headers=headers_a,
    )
    assert consent_resp.status_code == 201
    request_id = consent_resp.json()["id"]

    resp = await client.post(
        f"/v1/messages/consent/{request_id}/accept",
        headers=headers_b,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["consent_id"] == request_id
    assert set([data["user_a"], data["user_b"]]) == {user_id_a, user_id_b}
    assert data["ended_at"] is None


@pytest.mark.asyncio
async def test_decline_consent(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """POST /v1/messages/consent/{id}/decline marks request as declined."""
    headers_a, _user_id_a = user_a
    headers_b, user_id_b = user_b

    user_b_obj = await _get_user(db_session, user_id_b)
    consent_resp = await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id)},
        headers=headers_a,
    )
    assert consent_resp.status_code == 201
    request_id = consent_resp.json()["id"]

    resp = await client.post(
        f"/v1/messages/consent/{request_id}/decline",
        headers=headers_b,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == DMConsentStatus.DECLINED.value
    assert data["responded_at"] is not None


@pytest.mark.asyncio
async def test_list_conversations(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """GET /v1/messages/conversations lists conversations for the current user."""
    headers_a, user_id_a = user_a
    headers_b, user_id_b = user_b

    conversation_id = await _setup_accepted_conversation(
        client, db_session, headers_a, user_id_a, headers_b, user_id_b
    )

    resp = await client.get("/v1/messages/conversations", headers=headers_a)
    assert resp.status_code == 200
    conversations = resp.json()
    assert isinstance(conversations, list)
    assert len(conversations) >= 1
    assert any(c["id"] == conversation_id for c in conversations)


@pytest.mark.asyncio
async def test_send_message(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """POST /v1/messages/conversations/{id} sends a message in a conversation."""
    headers_a, user_id_a = user_a
    headers_b, user_id_b = user_b

    conversation_id = await _setup_accepted_conversation(
        client, db_session, headers_a, user_id_a, headers_b, user_id_b
    )

    resp = await client.post(
        f"/v1/messages/conversations/{conversation_id}",
        json={"body": "Hello, I would like to help you."},
        headers=headers_a,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["body"] == "Hello, I would like to help you."
    assert data["sender_id"] == user_id_a
    assert data["conversation_id"] == conversation_id
    assert data["read_at"] is None


@pytest.mark.asyncio
async def test_get_messages(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """GET /v1/messages/conversations/{id} returns paginated messages."""
    headers_a, user_id_a = user_a
    headers_b, user_id_b = user_b

    conversation_id = await _setup_accepted_conversation(
        client, db_session, headers_a, user_id_a, headers_b, user_id_b
    )

    # Send two messages from A, one from B
    await client.post(
        f"/v1/messages/conversations/{conversation_id}",
        json={"body": "Message one from A."},
        headers=headers_a,
    )
    await client.post(
        f"/v1/messages/conversations/{conversation_id}",
        json={"body": "Reply from B."},
        headers=headers_b,
    )

    resp = await client.get(
        f"/v1/messages/conversations/{conversation_id}",
        headers=headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "conversation" in data
    assert "messages" in data
    assert data["conversation"]["id"] == conversation_id
    assert len(data["messages"]) == 2
    bodies = [m["body"] for m in data["messages"]]
    assert "Message one from A." in bodies
    assert "Reply from B." in bodies


@pytest.mark.asyncio
async def test_message_requires_consent(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """Cannot send a message to a conversation the user is not part of."""
    headers_a, user_id_a = user_a
    headers_b, user_id_b = user_b

    # Accept conversation between A and B
    conversation_id = await _setup_accepted_conversation(
        client, db_session, headers_a, user_id_a, headers_b, user_id_b
    )

    # Create a third user with no involvement
    from app.services.auth_service import create_otp
    from app.models.invite import InviteCode as IC

    third_invite = IC(
        code="MSG-INVITE-003",
        created_by=uuid4(),
        max_uses=5,
        use_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        revoked=False,
    )
    db_session.add(third_invite)
    await db_session.commit()

    third_headers, _ = await _create_authenticated_user(
        client,
        db_session,
        "MSG-INVITE-003",
        name="Third Party",
        phone="+918000000099",
        email="thirdparty@example.com",
    )

    resp = await client.post(
        f"/v1/messages/conversations/{conversation_id}",
        json={"body": "Intruding message."},
        headers=third_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_consent_request_rejected(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """A second pending consent request to the same user is rejected with 409."""
    headers_a, _user_id_a = user_a
    _headers_b, user_id_b = user_b

    user_b_obj = await _get_user(db_session, user_id_b)

    await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id)},
        headers=headers_a,
    )

    resp = await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id)},
        headers=headers_a,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_only_recipient_can_accept(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    """The sender cannot accept their own consent request."""
    headers_a, _user_id_a = user_a
    _headers_b, user_id_b = user_b

    user_b_obj = await _get_user(db_session, user_id_b)
    consent_resp = await client.post(
        "/v1/messages/request-consent",
        json={"to_user_id": str(user_b_obj.id)},
        headers=headers_a,
    )
    request_id = consent_resp.json()["id"]

    # A tries to accept their own request
    resp = await client.post(
        f"/v1/messages/consent/{request_id}/accept",
        headers=headers_a,
    )
    assert resp.status_code == 403
