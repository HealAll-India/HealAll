"""What members see of their conversations: who it's with, the latest message, newest page first."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.models.invite import InviteCode
from app.models.privacy import UserBlock
from app.models.user import User
from app.services.auth_service import create_otp
from app.services.message_service import FORMER_MEMBER_NAME, PREVIEW_CHARS

Member = tuple[dict[str, str], str]


@pytest.fixture
async def invite(db_session: AsyncSession) -> InviteCode:
    """The invite the members joined with, seeded directly (no signup API)."""
    code = InviteCode(
        code="CONV-INVITE-001",
        created_by=uuid4(),
        max_uses=10,
        use_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    db_session.add(code)
    await db_session.commit()
    return code


async def _member(client: AsyncClient, db_session: AsyncSession, invite: InviteCode, name: str, phone: str) -> Member:
    """A verified member seeded via the ORM, signed in with an OTP from auth_service.create_otp."""
    user = User(
        name=name,
        phone=phone,
        email=f"{phone.lstrip('+')}@example.com",
        city="Delhi",
        age_range="25-34",
        roles=[UserRole.HELPER.value],
        phone_verified=True,
        email_verified=True,
        verification_level=1,
    )
    invite.use_count += 1
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    otp, _ = await create_otp(db_session, phone, "login")
    await db_session.commit()
    resp = await client.post("/v1/auth/token", json={"phone_or_email": phone, "otp_code": otp})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}, str(user.id)


@pytest.fixture
async def user_a(client: AsyncClient, db_session: AsyncSession, invite: InviteCode) -> Member:
    return await _member(client, db_session, invite, "Sender User", "+918000000001")


@pytest.fixture
async def user_b(client: AsyncClient, db_session: AsyncSession, invite: InviteCode) -> Member:
    return await _member(client, db_session, invite, "Recipient User", "+918000000002")


@pytest.fixture
async def user_c(client: AsyncClient, db_session: AsyncSession, invite: InviteCode) -> Member:
    return await _member(client, db_session, invite, "Third Member", "+918000000003")


async def _setup_accepted_conversation(client: AsyncClient, headers_from: dict, headers_to: dict, id_to: str) -> str:
    """The real consent flow: one member asks, the other accepts. Returns the conversation id."""
    asked = await client.post("/v1/messages/request-consent", json={"to_user_id": id_to}, headers=headers_from)
    assert asked.status_code == 201, asked.text
    accepted = await client.post(f"/v1/messages/consent/{asked.json()['id']}/accept", headers=headers_to)
    assert accepted.status_code == 200, accepted.text
    return accepted.json()["id"]


async def _send(client: AsyncClient, conversation_id: str, headers: dict, body: str) -> None:
    resp = await client.post(f"/v1/messages/conversations/{conversation_id}", json={"body": body}, headers=headers)
    assert resp.status_code == 201, resp.text


async def _list(client: AsyncClient, headers: dict) -> list[dict]:
    resp = await client.get("/v1/messages/conversations", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_list_names_the_other_member_and_previews_the_latest_message(
    client: AsyncClient,
    user_a: tuple,
    user_b: tuple,
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, headers_a, headers_b, id_b)
    await _send(client, conversation_id, headers_a, "Hello, I can help.")
    await _send(client, conversation_id, headers_b, "Thank you, that would mean a lot.")

    [mine] = await _list(client, headers_a)
    assert mine["other_member"] == {"id": id_b, "name": "Recipient User", "avatar_url": None}
    assert mine["last_message"]["body"] == "Thank you, that would mean a lot."
    assert mine["last_message"]["sender_id"] == id_b

    [theirs] = await _list(client, headers_b)
    assert theirs["other_member"]["name"] == "Sender User"


@pytest.mark.asyncio
async def test_a_conversation_without_messages_has_no_preview(
    client: AsyncClient,
    user_a: tuple,
    user_b: tuple,
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    await _setup_accepted_conversation(client, headers_a, headers_b, id_b)

    [conversation] = await _list(client, headers_a)
    assert conversation["last_message"] is None
    assert conversation["other_member"]["name"] == "Recipient User"


@pytest.mark.asyncio
async def test_list_puts_the_most_recent_activity_first(
    client: AsyncClient,
    user_a: tuple,
    user_b: tuple,
    user_c: tuple,
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    headers_c, id_c = user_c
    with_b = await _setup_accepted_conversation(client, headers_a, headers_b, id_b)
    with_c = await _setup_accepted_conversation(client, headers_a, headers_c, id_c)

    await _send(client, with_b, headers_a, "Older message")
    await _send(client, with_c, headers_a, "Newer message")
    assert [c["id"] for c in await _list(client, headers_a)] == [with_c, with_b]

    await _send(client, with_b, headers_b, "Newest reply")
    assert [c["id"] for c in await _list(client, headers_a)] == [with_b, with_c]


@pytest.mark.asyncio
async def test_long_messages_are_shortened_for_the_preview(
    client: AsyncClient,
    user_a: tuple,
    user_b: tuple,
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, headers_a, headers_b, id_b)
    await _send(client, conversation_id, headers_a, "word " * 100)

    [conversation] = await _list(client, headers_a)
    body = conversation["last_message"]["body"]
    assert len(body) <= PREVIEW_CHARS
    assert body.endswith("…")
    assert body.startswith("word word")


@pytest.mark.asyncio
async def test_no_preview_across_a_block(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    # Opening the thread is refused across a block, so the list mustn't show its latest message either.
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, headers_a, headers_b, id_b)
    await _send(client, conversation_id, headers_b, "Something private")
    db_session.add(UserBlock(blocker_id=UUID(id_b), blocked_id=UUID(id_a)))
    await db_session.commit()

    for headers in (headers_a, headers_b):
        [conversation] = await _list(client, headers)
        assert conversation["last_message"] is None
        # The thread is refused, so clients show it as unavailable rather than inviting a hello.
        assert conversation["blocked"] is True


@pytest.mark.asyncio
async def test_a_blocked_conversation_keeps_its_place_by_latest_activity(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
    user_c: tuple,
):
    # Hiding the preview must not drop the conversation to its creation date in the order.
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    headers_c, id_c = user_c
    with_b = await _setup_accepted_conversation(client, headers_a, headers_b, id_b)
    with_c = await _setup_accepted_conversation(client, headers_a, headers_c, id_c)
    await _send(client, with_c, headers_a, "Older message")
    await _send(client, with_b, headers_a, "Newer message")
    db_session.add(UserBlock(blocker_id=UUID(id_b), blocked_id=UUID(id_a)))
    await db_session.commit()

    listed = await _list(client, headers_a)
    assert [c["id"] for c in listed] == [with_b, with_c]
    assert [c["blocked"] for c in listed] == [True, False]


@pytest.mark.asyncio
async def test_a_deleted_member_shows_as_a_former_member(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,
    user_b: tuple,
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, headers_a, headers_b, id_b)
    await db_session.execute(
        update(User)
        .where(User.id == UUID(id_b))
        .values(deleted_at=datetime.now(UTC), avatar_url="https://x.test/p.jpg")
    )
    await db_session.commit()

    [conversation] = await _list(client, headers_a)
    assert conversation["other_member"] == {"id": id_b, "name": FORMER_MEMBER_NAME, "avatar_url": None}

    detail = await client.get(f"/v1/messages/conversations/{conversation_id}", headers=headers_a)
    assert detail.json()["conversation"]["other_member"]["name"] == FORMER_MEMBER_NAME


@pytest.mark.asyncio
async def test_thread_page_one_holds_the_newest_messages(
    client: AsyncClient,
    user_a: tuple,
    user_b: tuple,
):
    # It used to return the oldest page, so a thread over 50 messages never showed its latest ones.
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, headers_a, headers_b, id_b)
    for n in range(1, 6):
        await _send(client, conversation_id, headers_a, f"message {n}")

    async def page(number: int) -> dict:
        resp = await client.get(
            f"/v1/messages/conversations/{conversation_id}",
            params={"page": number, "per_page": 2},
            headers=headers_a,
        )
        assert resp.status_code == 200, resp.text
        return resp.json()

    first = await page(1)
    assert [m["body"] for m in first["messages"]] == ["message 4", "message 5"]
    assert first["has_more"] is True
    assert first["conversation"]["other_member"]["name"] == "Recipient User"

    assert [m["body"] for m in (await page(2))["messages"]] == ["message 2", "message 3"]
    last = await page(3)
    assert [m["body"] for m in last["messages"]] == ["message 1"]
    assert last["has_more"] is False
