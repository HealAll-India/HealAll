"""What members see of their conversations: who it's with, the latest message, newest page first."""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.privacy import UserBlock
from app.models.user import User
from app.services.message_service import FORMER_MEMBER_NAME, PREVIEW_CHARS
from tests.integration.test_messages import (  # noqa: F401  (fixtures are used by name)
    _create_authenticated_user,
    _setup_accepted_conversation,
    invite_code,
    user_a,
    user_b,
)


@pytest.fixture
async def user_c(client: AsyncClient, db_session: AsyncSession, invite_code) -> tuple[dict[str, str], str]:  # noqa: F811
    return await _create_authenticated_user(
        client,
        db_session,
        invite_code.code,
        name="Third Member",
        phone="+918000000003",
        email="third@example.com",
    )


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
    db_session: AsyncSession,
    user_a: tuple,  # noqa: F811
    user_b: tuple,  # noqa: F811
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_b, id_b)
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
    db_session: AsyncSession,
    user_a: tuple,  # noqa: F811
    user_b: tuple,  # noqa: F811
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_b, id_b)

    [conversation] = await _list(client, headers_a)
    assert conversation["last_message"] is None
    assert conversation["other_member"]["name"] == "Recipient User"


@pytest.mark.asyncio
async def test_list_puts_the_most_recent_activity_first(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,  # noqa: F811
    user_b: tuple,  # noqa: F811
    user_c: tuple,
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    headers_c, id_c = user_c
    with_b = await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_b, id_b)
    with_c = await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_c, id_c)

    await _send(client, with_b, headers_a, "Older message")
    await _send(client, with_c, headers_a, "Newer message")
    assert [c["id"] for c in await _list(client, headers_a)] == [with_c, with_b]

    await _send(client, with_b, headers_b, "Newest reply")
    assert [c["id"] for c in await _list(client, headers_a)] == [with_b, with_c]


@pytest.mark.asyncio
async def test_long_messages_are_shortened_for_the_preview(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,  # noqa: F811
    user_b: tuple,  # noqa: F811
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_b, id_b)
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
    user_a: tuple,  # noqa: F811
    user_b: tuple,  # noqa: F811
):
    # Opening the thread is refused across a block, so the list mustn't show its latest message either.
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_b, id_b)
    await _send(client, conversation_id, headers_b, "Something private")
    db_session.add(UserBlock(blocker_id=id_b, blocked_id=id_a))
    await db_session.commit()

    for headers in (headers_a, headers_b):
        [conversation] = await _list(client, headers)
        assert conversation["last_message"] is None


@pytest.mark.asyncio
async def test_a_deleted_member_shows_as_a_former_member(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,  # noqa: F811
    user_b: tuple,  # noqa: F811
):
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_b, id_b)
    await db_session.execute(
        update(User).where(User.id == id_b).values(deleted_at=datetime.now(UTC), avatar_url="https://x.test/p.jpg")
    )
    await db_session.commit()

    [conversation] = await _list(client, headers_a)
    assert conversation["other_member"] == {"id": id_b, "name": FORMER_MEMBER_NAME, "avatar_url": None}

    detail = await client.get(f"/v1/messages/conversations/{conversation_id}", headers=headers_a)
    assert detail.json()["conversation"]["other_member"]["name"] == FORMER_MEMBER_NAME


@pytest.mark.asyncio
async def test_thread_page_one_holds_the_newest_messages(
    client: AsyncClient,
    db_session: AsyncSession,
    user_a: tuple,  # noqa: F811
    user_b: tuple,  # noqa: F811
):
    # It used to return the oldest page, so a thread over 50 messages never showed its latest ones.
    headers_a, id_a = user_a
    headers_b, id_b = user_b
    conversation_id = await _setup_accepted_conversation(client, db_session, headers_a, id_a, headers_b, id_b)
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
