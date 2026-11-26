"""Integration tests for web push: subscriptions, triggers and delivery (push services stubbed)."""

import json
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from pywebpush import WebPushException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.core.constants import UserRole
from app.core.security import create_access_token
from app.models.case import Case, CaseStatus
from app.models.post import Post, PostStatus
from app.models.privacy import UserBlock
from app.models.push import PushSubscription
from app.models.user import User
from app.services import push_service

FCM = "https://fcm.googleapis.com/fcm/send/"
P256DH = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
AUTH = "tBHItJI5svbpez7KI4CCXg"

# Text that must never reach a lock screen.
SECRET_MESSAGE = "SECRET-MESSAGE-TEXT about my diagnosis"
SECRET_COMMENT = "SECRET-COMMENT-TEXT with my address"
SECRET_POST = "SECRET-POST-TITLE needs rent money"


@pytest.fixture
def push_on(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "test-public-key")
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "test-private-key")


@pytest.fixture
def push_off(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", None)
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", None)


@pytest.fixture
def sent(monkeypatch) -> list[dict]:
    """Record notify_user calls instead of sending."""
    calls: list[dict] = []

    async def fake_notify_user(user_id, title, body, url, tag):
        calls.append({"user_id": user_id, "title": title, "body": body, "url": url, "tag": tag})

    monkeypatch.setattr(push_service, "notify_user", fake_notify_user)
    return calls


async def _user(db: AsyncSession, suffix: str, name: str, roles: list[str] | None = None) -> User:
    user = User(
        name=name,
        phone=f"+91444444{suffix}",
        email=f"push_{suffix}@example.com",
        city="Delhi",
        age_range="25-34",
        roles=roles or [UserRole.HELPER.value, UserRole.HELP_SEEKER.value],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def _auth(user: User) -> dict[str, str]:
    token = create_access_token(subject=str(user.id), roles=user.roles, verification_level=user.verification_level)
    return {"Authorization": f"Bearer {token}"}


async def _post(db: AsyncSession, author: User) -> Post:
    post = Post(
        author_id=author.id,
        title=SECRET_POST,
        description=f"{SECRET_POST}, details here.",
        category="navigation",
        urgency="normal",
        city="Delhi",
        status=PostStatus.ACTIVE.value,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def _case(db: AsyncSession, author: User, owner: User | None = None) -> Case:
    post = await _post(db, author)
    case = Case(post_id=post.id, status=CaseStatus.ACTIVE.value, owner_id=owner.id if owner else None)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


async def _block(db: AsyncSession, blocker: User, blocked: User) -> None:
    db.add(UserBlock(blocker_id=blocker.id, blocked_id=blocked.id))
    await db.commit()


def _subscription(endpoint: str = f"{FCM}device-1", p256dh: str = P256DH, auth: str = AUTH) -> dict:
    return {"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}}


async def _rows(db: AsyncSession) -> list[tuple]:
    result = await db.execute(
        select(
            PushSubscription.user_id,
            PushSubscription.endpoint,
            PushSubscription.p256dh,
            PushSubscription.auth,
            PushSubscription.user_agent,
            PushSubscription.last_success_at,
        ).order_by(PushSubscription.endpoint)
    )
    return list(result.all())


def _assert_no_content(call: dict) -> None:
    shown = " ".join(str(call[key]) for key in ("title", "body", "url", "tag"))
    for secret in ("SECRET", "diagnosis", "address", "rent", "Sharma", "Rao", "Mehta"):
        assert secret not in shown, f"{secret!r} leaked into {call}"
    assert call["url"].startswith("/") and not call["url"].startswith("//")


@pytest.fixture
async def priya(db_session: AsyncSession) -> User:
    return await _user(db_session, "0001", "Priya Sharma")


@pytest.fixture
async def arjun(db_session: AsyncSession) -> User:
    return await _user(db_session, "0002", "Arjun Rao")


@pytest.fixture
async def meera(db_session: AsyncSession) -> User:
    return await _user(db_session, "0003", "Meera Mehta")


# ---------------------------------------------------------------------------
# Public key
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_key_says_disabled_without_keys(client: AsyncClient, push_off):
    response = await client.get("/v1/push/public-key")
    assert response.status_code == 200
    assert response.json() == {"enabled": False, "public_key": None}


@pytest.mark.asyncio
async def test_public_key_is_served_when_configured(client: AsyncClient, push_on):
    response = await client.get("/v1/push/public-key")
    assert response.status_code == 200
    assert response.json() == {"enabled": True, "public_key": "test-public-key"}


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_subscription_routes_require_sign_in(client: AsyncClient):
    assert (await client.post("/v1/push/subscriptions", json=_subscription())).status_code == 401
    response = await client.request("DELETE", "/v1/push/subscriptions", json={"endpoint": f"{FCM}device-1"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_subscribe_saves_then_updates_the_same_endpoint(
    client: AsyncClient, db_session: AsyncSession, priya: User
):
    headers = {**_auth(priya), "User-Agent": "Mozilla/5.0 " + "x" * 400}
    response = await client.post("/v1/push/subscriptions", json=_subscription(), headers=headers)
    assert response.status_code == 204

    rows = await _rows(db_session)
    assert len(rows) == 1
    assert rows[0].user_id == priya.id
    assert len(rows[0].user_agent) == 255

    renewed = _subscription(auth="bmV3LWF1dGgta2V5LTE2Yg")
    response = await client.post("/v1/push/subscriptions", json=renewed, headers=_auth(priya))
    assert response.status_code == 204
    rows = await _rows(db_session)
    assert len(rows) == 1
    assert rows[0].auth == "bmV3LWF1dGgta2V5LTE2Yg"


@pytest.mark.asyncio
async def test_subscribe_moves_a_shared_device_to_the_new_member(
    client: AsyncClient, db_session: AsyncSession, priya: User, arjun: User
):
    await client.post("/v1/push/subscriptions", json=_subscription(), headers=_auth(priya))
    response = await client.post("/v1/push/subscriptions", json=_subscription(), headers=_auth(arjun))
    assert response.status_code == 204

    rows = await _rows(db_session)
    assert [row.user_id for row in rows] == [arjun.id]


@pytest.mark.asyncio
async def test_subscribe_keeps_only_the_newest_devices(client: AsyncClient, db_session: AsyncSession, priya: User):
    total = push_service.MAX_SUBSCRIPTIONS_PER_USER + 2
    for i in range(total):
        response = await client.post(
            "/v1/push/subscriptions", json=_subscription(f"{FCM}device-{i:02d}"), headers=_auth(priya)
        )
        assert response.status_code == 204

    endpoints = {row.endpoint for row in await _rows(db_session)}
    assert len(endpoints) == push_service.MAX_SUBSCRIPTIONS_PER_USER
    assert f"{FCM}device-{total - 1:02d}" in endpoints
    assert f"{FCM}device-00" not in endpoints


@pytest.mark.asyncio
async def test_unsubscribe_deletes_only_the_callers_own_row(
    client: AsyncClient, db_session: AsyncSession, priya: User, arjun: User
):
    await client.post("/v1/push/subscriptions", json=_subscription(), headers=_auth(priya))
    body = {"endpoint": f"{FCM}device-1"}

    response = await client.request("DELETE", "/v1/push/subscriptions", json=body, headers=_auth(arjun))
    assert response.status_code == 204
    assert [row.user_id for row in await _rows(db_session)] == [priya.id]

    response = await client.request("DELETE", "/v1/push/subscriptions", json=body, headers=_auth(priya))
    assert response.status_code == 204
    assert await _rows(db_session) == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "subscription",
    [
        _subscription("http://fcm.googleapis.com/fcm/send/abc"),
        _subscription("https://evil.example.com/fcm.googleapis.com"),
        _subscription("https://fcm.googleapis.com.evil.example.com/abc"),
        _subscription("https://fcm.googleapis.com:8443/fcm/send/abc"),
        _subscription("https://user:pass@fcm.googleapis.com/fcm/send/abc"),
        _subscription("https://169.254.169.254/latest/meta-data"),
        _subscription("not a url"),
        _subscription(f"{FCM}{'a' * 1100}"),
        _subscription(p256dh="not base64 url!"),
        _subscription(p256dh="A" * 200),
        _subscription(auth=""),
        {"endpoint": f"{FCM}device-1"},
    ],
)
async def test_subscribe_rejects_bad_subscriptions(
    client: AsyncClient, db_session: AsyncSession, priya: User, subscription: dict
):
    response = await client.post("/v1/push/subscriptions", json=subscription, headers=_auth(priya))
    assert response.status_code == 422
    assert await _rows(db_session) == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "endpoint",
    [
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
        "https://web.push.apple.com/QGuQyavXutnMsb",
        "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ],
)
async def test_subscribe_accepts_other_browser_push_services(
    client: AsyncClient, db_session: AsyncSession, priya: User, endpoint: str
):
    response = await client.post("/v1/push/subscriptions", json=_subscription(endpoint), headers=_auth(priya))
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_subscriptions_go_with_the_account(client: AsyncClient, db_session: AsyncSession, priya: User):
    await client.post("/v1/push/subscriptions", json=_subscription(), headers=_auth(priya))
    await db_session.execute(delete(User).where(User.id == priya.id))
    await db_session.commit()
    assert await _rows(db_session) == []


# ---------------------------------------------------------------------------
# Triggers
# ---------------------------------------------------------------------------


async def _accepted_conversation(client: AsyncClient, sender: User, recipient: User) -> str:
    response = await client.post(
        "/v1/messages/request-consent", json={"to_user_id": str(recipient.id)}, headers=_auth(sender)
    )
    assert response.status_code == 201, response.text
    response = await client.post(f"/v1/messages/consent/{response.json()['id']}/accept", headers=_auth(recipient))
    assert response.status_code == 200, response.text
    return response.json()["id"]


@pytest.mark.asyncio
async def test_message_request_and_acceptance_notify_the_other_member(
    client: AsyncClient, priya: User, arjun: User, push_on, sent: list[dict]
):
    response = await client.post(
        "/v1/messages/request-consent", json={"to_user_id": str(arjun.id)}, headers=_auth(priya)
    )
    assert response.status_code == 201
    consent_id = response.json()["id"]
    assert sent == [
        {
            "user_id": arjun.id,
            "title": "New message request",
            "body": "Priya would like to message you",
            "url": "/messages",
            "tag": f"consent-{consent_id}",
        }
    ]

    response = await client.post(f"/v1/messages/consent/{consent_id}/accept", headers=_auth(arjun))
    assert response.status_code == 200
    conversation_id = response.json()["id"]
    assert sent[1] == {
        "user_id": priya.id,
        "title": "Message request accepted",
        "body": "Arjun accepted your message request",
        "url": f"/messages/{conversation_id}",
        "tag": f"conversation-{conversation_id}",
    }
    for call in sent:
        _assert_no_content(call)


@pytest.mark.asyncio
async def test_new_message_notifies_the_other_member_without_its_text(
    client: AsyncClient, priya: User, arjun: User, push_on, sent: list[dict]
):
    conversation_id = await _accepted_conversation(client, priya, arjun)
    sent.clear()

    response = await client.post(
        f"/v1/messages/conversations/{conversation_id}", json={"body": SECRET_MESSAGE}, headers=_auth(arjun)
    )
    assert response.status_code == 201
    assert sent == [
        {
            "user_id": priya.id,
            "title": "New message",
            "body": "Arjun sent you a message",
            "url": f"/messages/{conversation_id}",
            "tag": f"conversation-{conversation_id}",
        }
    ]
    _assert_no_content(sent[0])


@pytest.mark.asyncio
async def test_comment_notifies_the_post_author_but_not_themself(
    client: AsyncClient, db_session: AsyncSession, priya: User, arjun: User, push_on, sent: list[dict]
):
    post = await _post(db_session, priya)

    response = await client.post(f"/v1/posts/{post.id}/comments", json={"body": SECRET_COMMENT}, headers=_auth(arjun))
    assert response.status_code == 201
    assert sent == [
        {
            "user_id": priya.id,
            "title": "New comment",
            "body": "Arjun commented on your post",
            "url": f"/posts/{post.id}",
            "tag": f"comments-{post.id}",
        }
    ]
    _assert_no_content(sent[0])

    sent.clear()
    response = await client.post(f"/v1/posts/{post.id}/comments", json={"body": SECRET_COMMENT}, headers=_auth(priya))
    assert response.status_code == 201
    assert sent == []


@pytest.mark.asyncio
async def test_help_offer_notifies_the_author_and_case_owner(
    client: AsyncClient, db_session: AsyncSession, priya: User, arjun: User, meera: User, push_on, sent: list[dict]
):
    case = await _case(db_session, priya, owner=meera)

    response = await client.post(f"/v1/cases/{case.id}/helpers", headers=_auth(arjun))
    assert response.status_code == 201
    assert {call["user_id"] for call in sent} == {priya.id, meera.id}
    for call in sent:
        assert call["title"] == "Someone offered to help"
        assert call["body"] == "Arjun offered to help with your case"
        assert call["url"] == f"/cases/{case.id}"
        _assert_no_content(call)


@pytest.mark.asyncio
async def test_help_offer_does_not_notify_the_helper_themself(
    client: AsyncClient, db_session: AsyncSession, priya: User, meera: User, push_on, sent: list[dict]
):
    case = await _case(db_session, priya, owner=meera)

    response = await client.post(f"/v1/cases/{case.id}/helpers", headers=_auth(meera))
    assert response.status_code == 201
    assert [call["user_id"] for call in sent] == [priya.id]


@pytest.mark.asyncio
@pytest.mark.parametrize("author_blocks", [True, False])
async def test_help_offer_across_a_block_notifies_nobody(
    client: AsyncClient,
    db_session: AsyncSession,
    priya: User,
    arjun: User,
    push_on,
    sent: list[dict],
    author_blocks: bool,
):
    case = await _case(db_session, priya)
    if author_blocks:
        await _block(db_session, priya, arjun)
    else:
        await _block(db_session, arjun, priya)

    response = await client.post(f"/v1/cases/{case.id}/helpers", headers=_auth(arjun))
    assert response.status_code == 201
    assert sent == []


@pytest.mark.asyncio
async def test_recipients_skip_the_actor_and_blocks_either_way(
    db_session: AsyncSession, priya: User, arjun: User, meera: User, push_on
):
    other = await _user(db_session, "0004", "Kabir Singh")
    await _block(db_session, priya, arjun)
    await _block(db_session, meera, priya)

    wanted = [arjun.id, meera.id, other.id, priya.id, None, other.id]
    assert await push_service.recipients(db_session, priya.id, wanted) == [other.id]


@pytest.mark.asyncio
async def test_nothing_is_queued_while_push_is_off(
    client: AsyncClient, db_session: AsyncSession, priya: User, arjun: User, push_off, sent: list[dict]
):
    post = await _post(db_session, priya)
    await client.post(f"/v1/posts/{post.id}/comments", json={"body": "hello"}, headers=_auth(arjun))
    await _accepted_conversation(client, priya, arjun)
    assert sent == []


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------


@pytest.fixture
def own_session(monkeypatch, engine):
    """notify_user opens its own session; point it at the test database."""
    monkeypatch.setattr(push_service, "async_session_maker", async_sessionmaker(engine, expire_on_commit=False))


async def _subscribe_rows(db: AsyncSession, user: User, names: list[str]) -> None:
    for name in names:
        db.add(PushSubscription(user_id=user.id, endpoint=f"{FCM}{name}", p256dh=P256DH, auth=AUTH))
    await db.commit()


@pytest.mark.asyncio
async def test_notify_user_delivers_prunes_gone_devices_and_records_success(
    db_session: AsyncSession, priya: User, arjun: User, push_on, own_session, monkeypatch
):
    await _subscribe_rows(db_session, priya, ["ok", "gone", "broken"])
    await _subscribe_rows(db_session, arjun, ["someone-else"])
    deliveries: list[tuple[str, dict]] = []
    outcomes = {"ok": "DELIVERED", "gone": "GONE", "broken": "FAILED"}

    def fake_deliver(endpoint, p256dh, auth, payload):
        deliveries.append((endpoint, json.loads(payload)))
        return push_service._Outcome[outcomes[endpoint.removeprefix(FCM)]]

    monkeypatch.setattr(push_service, "_deliver", fake_deliver)
    await push_service.notify_user(priya.id, "New message", "Arjun sent you a message", "/messages/abc", "t1")

    assert sorted(endpoint.removeprefix(FCM) for endpoint, _ in deliveries) == ["broken", "gone", "ok"]
    for _, payload in deliveries:
        assert payload == {
            "title": "New message",
            "body": "Arjun sent you a message",
            "url": "/messages/abc",
            "tag": "t1",
        }

    rows = {row.endpoint.removeprefix(FCM): row for row in await _rows(db_session)}
    assert set(rows) == {"ok", "broken", "someone-else"}
    assert rows["ok"].last_success_at is not None
    assert rows["broken"].last_success_at is None


@pytest.mark.asyncio
async def test_notify_user_sends_only_same_site_paths(
    db_session: AsyncSession, priya: User, push_on, own_session, monkeypatch
):
    await _subscribe_rows(db_session, priya, ["ok"])
    urls: list[str] = []

    def fake_deliver(endpoint, p256dh, auth, payload):
        urls.append(json.loads(payload)["url"])
        return push_service._Outcome.DELIVERED

    monkeypatch.setattr(push_service, "_deliver", fake_deliver)
    for url in ("https://evil.example.com/", "//evil.example.com/x", "/\\evil.example.com"):
        await push_service.notify_user(priya.id, "t", "b", url, "tag")
    assert urls == ["/", "/", "/"]


@pytest.mark.asyncio
async def test_notify_user_skips_inactive_members_and_does_nothing_while_off(
    db_session: AsyncSession, priya: User, own_session, monkeypatch, push_on
):
    await _subscribe_rows(db_session, priya, ["ok"])
    calls: list[str] = []

    def fake_deliver(*args):
        calls.append("sent")
        return push_service._Outcome.DELIVERED

    monkeypatch.setattr(push_service, "_deliver", fake_deliver)

    priya.is_active = False
    await db_session.commit()
    await push_service.notify_user(priya.id, "t", "b", "/", "tag")
    assert calls == []

    priya.is_active = True
    await db_session.commit()
    settings = get_settings()
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", None)
    await push_service.notify_user(priya.id, "t", "b", "/", "tag")
    assert calls == []


@pytest.mark.asyncio
async def test_notify_user_never_raises(priya: User, push_on, monkeypatch):
    def broken_session():
        raise RuntimeError("database down")

    monkeypatch.setattr(push_service, "async_session_maker", SimpleNamespace(begin=broken_session))
    await push_service.notify_user(priya.id, "t", "b", "/", "tag")


@pytest.mark.parametrize(
    ("status", "expected"),
    [(404, "GONE"), (410, "GONE"), (429, "FAILED"), (500, "FAILED"), (None, "FAILED")],
)
def test_deliver_maps_push_service_answers(monkeypatch, push_on, status: int | None, expected: str):
    def refused(**kwargs):
        response = None if status is None else SimpleNamespace(status_code=status, text="", reason="")
        raise WebPushException("refused", response=response)

    monkeypatch.setattr(push_service, "_webpush", refused)
    assert push_service._deliver(f"{FCM}x", P256DH, AUTH, "{}") is push_service._Outcome[expected]


def test_deliver_signs_with_vapid_and_reports_network_errors(monkeypatch, push_on):
    seen: dict = {}

    def accept(**kwargs):
        seen.update(kwargs)

    monkeypatch.setattr(push_service, "_webpush", accept)
    assert push_service._deliver(f"{FCM}x", P256DH, AUTH, '{"title":"t"}') is push_service._Outcome.DELIVERED
    assert seen["vapid_private_key"] == "test-private-key"
    assert seen["vapid_claims"] == {"sub": "mailto:hello@healallindia.com"}
    assert seen["subscription_info"] == {"endpoint": f"{FCM}x", "keys": {"p256dh": P256DH, "auth": AUTH}}

    def offline(**kwargs):
        raise ConnectionError("no route")

    monkeypatch.setattr(push_service, "_webpush", offline)
    assert push_service._deliver(f"{FCM}x", P256DH, AUTH, "{}") is push_service._Outcome.FAILED


def test_first_name_never_shows_a_surname():
    assert push_service.first_name(User(name="Priya Sharma")) == "Priya"
    assert push_service.first_name(User(name="  ")) == "Someone"
