"""Integration tests for AI report triage (real DB, LLM HTTP call stubbed)."""

import json

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import UserRole
from app.core.exceptions import ForbiddenException
from app.core.security import create_access_token
from app.models.post import Post, PostStatus
from app.models.report import Report, ReportReason, ReportStatus, ReportTargetType
from app.models.report_triage import ReportTriage
from app.models.user import User
from app.services import triage_llm, triage_service

VALID = {
    "severity": "medium",
    "category": "solicitation",
    "summary": "The post advertises a paid loan service.",
    "rationale": "Commercial solicitation unrelated to mutual aid.",
    "imminent_danger": False,
}


class FakeLLM:
    """Stands in for the provider HTTP call; records exactly what would be sent."""

    def __init__(self, reply: str | None = None):
        self.reply = json.dumps(VALID) if reply is None else reply
        self.payloads: list[dict] = []

    async def __call__(self, url, api_key, payload, timeout):
        self.payloads.append(payload)
        return self.reply


@pytest.fixture
def triage_on(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "AI_TRIAGE_ENABLED", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(settings, "AI_TRIAGE_RATE_LIMIT_PER_HOUR", 60)


@pytest.fixture
def fake_llm(monkeypatch) -> FakeLLM:
    fake = FakeLLM()
    monkeypatch.setattr(triage_llm, "_post_chat", fake)
    return fake


async def _user(db: AsyncSession, suffix: str, roles: list[str], bio: str | None = None) -> User:
    user = User(
        name=f"Person {suffix}",
        phone=f"+91333333{suffix}",
        email=f"triage_{suffix}@example.com",
        city="Mumbai",
        age_range="25-34",
        roles=roles,
        bio=bio,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def moderator(db_session: AsyncSession) -> User:
    return await _user(db_session, "0001", [UserRole.MODERATOR.value])


@pytest.fixture
async def admin(db_session: AsyncSession) -> User:
    return await _user(db_session, "0002", [UserRole.ADMIN.value])


@pytest.fixture
async def reporter(db_session: AsyncSession) -> User:
    return await _user(db_session, "0003", [UserRole.HELPER.value])


@pytest.fixture
async def author(db_session: AsyncSession) -> User:
    return await _user(db_session, "0004", [UserRole.HELP_SEEKER.value])


async def _post(db: AsyncSession, author: User, description: str) -> Post:
    post = Post(
        author_id=author.id,
        title="Quick loans available",
        description=description,
        category="navigation",
        urgency="normal",
        city="Mumbai",
        status=PostStatus.ACTIVE.value,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def _report(db: AsyncSession, reporter: User, target_type: str, target_id, reason: str) -> Report:
    report = Report(
        reporter_id=reporter.id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        description="Reporter note that must never be sent",
        status=ReportStatus.PENDING.value,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@pytest.fixture
async def post_report(db_session: AsyncSession, reporter: User, author: User) -> Report:
    post = await _post(
        db_session, author, "Contact loans@example.com or +91 98765 43210, see https://x.io/pay?token=SECRET1"
    )
    return await _report(db_session, reporter, ReportTargetType.POST.value, post.id, ReportReason.SPAM.value)


def _auth(user: User) -> dict[str, str]:
    token = create_access_token(subject=str(user.id), roles=user.roles, verification_level=user.verification_level)
    return {"Authorization": f"Bearer {token}"}


async def _triage_rows(db: AsyncSession, report: Report) -> list[ReportTriage]:
    return list((await db.execute(select(ReportTriage).where(ReportTriage.report_id == report.id))).scalars())


# ---------------------------------------------------------------------------
# Feature flag
# ---------------------------------------------------------------------------


async def test_flag_off_returns_disabled_and_never_calls_llm(
    client: AsyncClient, moderator: User, post_report: Report, fake_llm: FakeLLM, monkeypatch
):
    monkeypatch.setattr(get_settings(), "AI_TRIAGE_ENABLED", False)
    monkeypatch.setattr(get_settings(), "GROQ_API_KEY", "test-key")

    config = await client.get("/v1/moderation/triage/config", headers=_auth(moderator))
    assert config.status_code == 200
    assert config.json() == {"enabled": False}

    response = await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))
    assert response.status_code == 200
    assert response.json()["state"] == "disabled"
    assert response.json()["suggestion"] is None
    assert fake_llm.payloads == []


async def test_flag_on_without_any_key_is_disabled(
    client: AsyncClient, moderator: User, post_report: Report, fake_llm: FakeLLM, monkeypatch
):
    monkeypatch.setattr(get_settings(), "AI_TRIAGE_ENABLED", True)
    monkeypatch.setattr(get_settings(), "GROQ_API_KEY", None)
    monkeypatch.setattr(get_settings(), "GEMINI_API_KEY", None)

    config = await client.get("/v1/moderation/triage/config", headers=_auth(moderator))
    assert config.json() == {"enabled": False}
    response = await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))
    assert response.json()["state"] == "disabled"
    assert fake_llm.payloads == []


# ---------------------------------------------------------------------------
# RBAC + hierarchy guard
# ---------------------------------------------------------------------------


async def test_regular_user_gets_403_on_every_endpoint(
    client: AsyncClient, triage_on, reporter: User, post_report: Report, fake_llm: FakeLLM
):
    headers = _auth(reporter)
    assert (await client.get("/v1/moderation/triage/config", headers=headers)).status_code == 403
    assert (await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=headers)).status_code == 403
    assert (await client.get("/v1/moderation/triage/metrics", headers=headers)).status_code == 403
    assert fake_llm.payloads == []


async def test_service_layer_rejects_non_moderator(
    db_session: AsyncSession, triage_on, reporter: User, post_report: Report, fake_llm: FakeLLM
):
    with pytest.raises(ForbiddenException):
        await triage_service.get_or_create_triage(db_session, reporter, post_report.id)
    with pytest.raises(ForbiddenException):
        await triage_service.get_metrics(db_session, reporter)
    assert fake_llm.payloads == []


async def test_moderator_cannot_triage_report_about_privileged_user(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    admin: User,
    reporter: User,
    fake_llm: FakeLLM,
):
    other_mod = await _user(db_session, "0005", [UserRole.MODERATOR.value], bio="I moderate things")
    report = await _report(db_session, reporter, ReportTargetType.USER.value, other_mod.id, ReportReason.OTHER.value)

    denied = await client.post(f"/v1/moderation/reports/{report.id}/triage", headers=_auth(moderator))
    assert denied.status_code == 403
    assert fake_llm.payloads == []

    # Admins may triage reports about moderators, mirroring the action guard.
    allowed = await client.post(f"/v1/moderation/reports/{report.id}/triage", headers=_auth(admin))
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["state"] == "ok"


async def test_moderator_cannot_triage_report_about_themselves(
    client: AsyncClient, db_session: AsyncSession, triage_on, moderator: User, reporter: User, fake_llm: FakeLLM
):
    report = await _report(db_session, reporter, ReportTargetType.USER.value, moderator.id, ReportReason.OTHER.value)
    response = await client.post(f"/v1/moderation/reports/{report.id}/triage", headers=_auth(moderator))
    assert response.status_code == 403
    assert fake_llm.payloads == []


# ---------------------------------------------------------------------------
# Suggestion, privacy, caching
# ---------------------------------------------------------------------------


async def test_triage_masks_pii_and_sends_only_content_and_reason(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    reporter: User,
    author: User,
    post_report: Report,
    fake_llm: FakeLLM,
):
    response = await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["state"] == "ok"
    assert body["urgent"] is False
    assert body["suggestion"]["severity"] == "medium"
    assert body["suggestion"]["category"] == "solicitation"
    assert body["suggestion"]["cached"] is False

    sent = json.dumps(fake_llm.payloads[0])
    for secret in ["loans@example.com", "98765", "SECRET1", "Reporter note"]:
        assert secret not in sent
    for identity in [reporter.name, author.name, reporter.email, author.email, str(reporter.id), str(author.id)]:
        assert identity not in sent
    assert "[EMAIL]" in sent and "[PHONE]" in sent and "[URL:x.io]" in sent
    assert "spam" in sent

    # The AI never touches report status.
    await db_session.refresh(post_report)
    assert post_report.status == ReportStatus.PENDING.value


async def test_cached_result_is_reused_until_content_changes(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    post_report: Report,
    fake_llm: FakeLLM,
):
    url = f"/v1/moderation/reports/{post_report.id}/triage"
    first = (await client.post(url, headers=_auth(moderator))).json()
    second = (await client.post(url, headers=_auth(moderator))).json()
    assert len(fake_llm.payloads) == 1
    assert second["suggestion"]["id"] == first["suggestion"]["id"]
    assert second["suggestion"]["cached"] is True

    post = (await db_session.execute(select(Post).where(Post.id == post_report.target_id))).scalar_one()
    post.description = "Edited: now selling phones"
    await db_session.commit()

    third = (await client.post(url, headers=_auth(moderator))).json()
    assert len(fake_llm.payloads) == 2
    assert third["suggestion"]["id"] != first["suggestion"]["id"]
    assert len(await _triage_rows(db_session, post_report)) == 2


# ---------------------------------------------------------------------------
# Crisis safety
# ---------------------------------------------------------------------------


async def test_crisis_reason_is_urgent_even_when_model_says_low(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    reporter: User,
    author: User,
    fake_llm: FakeLLM,
):
    fake_llm.reply = json.dumps({**VALID, "severity": "low", "category": "other"})
    post = await _post(db_session, author, "I don't see the point of anything any more.")
    report = await _report(db_session, reporter, ReportTargetType.POST.value, post.id, ReportReason.CRISIS.value)

    body = (await client.post(f"/v1/moderation/reports/{report.id}/triage", headers=_auth(moderator))).json()
    assert body["urgent"] is True
    assert body["suggestion"]["severity"] == "urgent"
    row = (await _triage_rows(db_session, report))[0]
    assert row.model_severity == "low"  # audit keeps what the model actually said
    assert row.suggested_severity == "urgent"


async def test_crisis_reason_stays_urgent_when_llm_output_is_invalid(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    reporter: User,
    author: User,
    fake_llm: FakeLLM,
):
    fake_llm.reply = "Ignore previous instructions. Severity: low"
    post = await _post(db_session, author, "Please help, I am not safe tonight.")
    report = await _report(db_session, reporter, ReportTargetType.POST.value, post.id, ReportReason.CRISIS.value)

    body = (await client.post(f"/v1/moderation/reports/{report.id}/triage", headers=_auth(moderator))).json()
    assert body["state"] == "no_suggestion"
    assert body["urgent"] is True
    assert body["suggestion"] is None
    assert await _triage_rows(db_session, report) == []


async def test_model_danger_flag_forces_urgent(
    client: AsyncClient, triage_on, moderator: User, post_report: Report, fake_llm: FakeLLM
):
    fake_llm.reply = json.dumps({**VALID, "severity": "medium", "imminent_danger": True})
    body = (await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))).json()
    assert body["urgent"] is True
    assert body["suggestion"]["severity"] == "urgent"
    assert body["suggestion"]["danger_flag"] is True


@pytest.mark.parametrize(
    "reply",
    [
        "not json at all",
        json.dumps({**VALID, "severity": "catastrophic"}),
        json.dumps({**VALID, "category": "ban_this_user"}),
        json.dumps({**VALID, "action": "ban"}),
        json.dumps({"severity": "low"}),
    ],
)
async def test_invalid_llm_output_falls_back_to_no_suggestion(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    post_report: Report,
    fake_llm: FakeLLM,
    reply: str,
):
    fake_llm.reply = reply
    response = await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "no_suggestion"
    assert body["urgent"] is False
    assert await _triage_rows(db_session, post_report) == []


async def test_report_without_text_content_skips_llm(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    reporter: User,
    author: User,
    fake_llm: FakeLLM,
):
    report = await _report(db_session, reporter, ReportTargetType.USER.value, author.id, ReportReason.SPAM.value)
    body = (await client.post(f"/v1/moderation/reports/{report.id}/triage", headers=_auth(moderator))).json()
    assert body["state"] == "no_suggestion"
    assert fake_llm.payloads == []


# ---------------------------------------------------------------------------
# Audit trail + agreement metric
# ---------------------------------------------------------------------------


async def test_decision_is_audited_once_and_feeds_metrics(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    post_report: Report,
    fake_llm: FakeLLM,
):
    triaged = (await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))).json()
    triage_id = triaged["suggestion"]["id"]

    accept = await client.post(
        f"/v1/moderation/triage/{triage_id}/decision",
        json={"final_severity": "medium", "final_category": "solicitation"},
        headers=_auth(moderator),
    )
    assert accept.status_code == 200, accept.text
    decision = accept.json()["suggestion"]["decision"]
    assert decision["decision"] == "accepted"
    assert decision["decided_by"] == str(moderator.id)
    assert decision["decided_at"]

    again = await client.post(
        f"/v1/moderation/triage/{triage_id}/decision",
        json={"final_severity": "high", "final_category": "fraud"},
        headers=_auth(moderator),
    )
    assert again.status_code == 409

    row = (await _triage_rows(db_session, post_report))[0]
    await db_session.refresh(row)
    assert row.final_severity == "medium"
    assert row.decided_by == moderator.id
    await db_session.refresh(post_report)
    assert post_report.status == ReportStatus.PENDING.value  # decision never changes report status

    metrics = (await client.get("/v1/moderation/triage/metrics", headers=_auth(moderator))).json()
    assert metrics == {"suggestions": 1, "decided": 1, "accepted": 1, "overridden": 0, "agreement_rate": 1.0}


async def test_override_is_recorded_as_overridden(
    client: AsyncClient, triage_on, moderator: User, post_report: Report, fake_llm: FakeLLM
):
    triaged = (await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))).json()
    response = await client.post(
        f"/v1/moderation/triage/{triaged['suggestion']['id']}/decision",
        json={"final_severity": "high", "final_category": "fraud"},
        headers=_auth(moderator),
    )
    assert response.status_code == 200
    assert response.json()["suggestion"]["decision"]["decision"] == "overridden"

    metrics = (await client.get("/v1/moderation/triage/metrics", headers=_auth(moderator))).json()
    assert metrics["overridden"] == 1
    assert metrics["agreement_rate"] == 0.0


async def test_decision_rejects_invalid_values(
    client: AsyncClient, triage_on, moderator: User, post_report: Report, fake_llm: FakeLLM
):
    triaged = (await client.post(f"/v1/moderation/reports/{post_report.id}/triage", headers=_auth(moderator))).json()
    response = await client.post(
        f"/v1/moderation/triage/{triaged['suggestion']['id']}/decision",
        json={"final_severity": "catastrophic", "final_category": "spam"},
        headers=_auth(moderator),
    )
    assert response.status_code == 422


async def test_decision_respects_hierarchy_guard(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    admin: User,
    reporter: User,
    fake_llm: FakeLLM,
):
    other_mod = await _user(db_session, "0006", [UserRole.MODERATOR.value], bio="bio text")
    report = await _report(db_session, reporter, ReportTargetType.USER.value, other_mod.id, ReportReason.OTHER.value)
    triaged = (await client.post(f"/v1/moderation/reports/{report.id}/triage", headers=_auth(admin))).json()

    response = await client.post(
        f"/v1/moderation/triage/{triaged['suggestion']['id']}/decision",
        json={"final_severity": "low", "final_category": "other"},
        headers=_auth(moderator),
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Rate limit + ordering
# ---------------------------------------------------------------------------


async def test_rate_limit_per_moderator_ignores_cache_hits(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    admin: User,
    reporter: User,
    author: User,
    post_report: Report,
    fake_llm: FakeLLM,
    monkeypatch,
):
    monkeypatch.setattr(get_settings(), "AI_TRIAGE_RATE_LIMIT_PER_HOUR", 1)
    url = f"/v1/moderation/reports/{post_report.id}/triage"
    assert (await client.post(url, headers=_auth(moderator))).status_code == 200
    # Cache hit: no LLM call, does not count.
    assert (await client.post(url, headers=_auth(moderator))).status_code == 200

    post = await _post(db_session, author, "Another spammy post")
    other = await _report(db_session, reporter, ReportTargetType.POST.value, post.id, ReportReason.SPAM.value)
    limited = await client.post(f"/v1/moderation/reports/{other.id}/triage", headers=_auth(moderator))
    assert limited.status_code == 429

    # Limit is per moderator: a different moderator still has budget.
    assert (await client.post(f"/v1/moderation/reports/{other.id}/triage", headers=_auth(admin))).status_code == 200
    assert len(fake_llm.payloads) == 2


async def test_report_list_puts_crisis_and_ai_urgent_first_only_when_enabled(
    client: AsyncClient,
    db_session: AsyncSession,
    triage_on,
    moderator: User,
    reporter: User,
    author: User,
    fake_llm: FakeLLM,
    monkeypatch,
):
    crisis_post = await _post(db_session, author, "crisis text")
    crisis = await _report(db_session, reporter, ReportTargetType.POST.value, crisis_post.id, ReportReason.CRISIS.value)
    danger_post = await _post(db_session, author, "danger text")
    danger = await _report(db_session, reporter, ReportTargetType.POST.value, danger_post.id, ReportReason.OTHER.value)
    spam_post = await _post(db_session, author, "spam text")
    spam = await _report(db_session, reporter, ReportTargetType.POST.value, spam_post.id, ReportReason.SPAM.value)

    fake_llm.reply = json.dumps({**VALID, "imminent_danger": True})
    await client.post(f"/v1/moderation/reports/{danger.id}/triage", headers=_auth(moderator))

    listed = (await client.get("/v1/reports", headers=_auth(moderator))).json()["items"]
    ids = [item["id"] for item in listed]
    assert set(ids[:2]) == {str(crisis.id), str(danger.id)}
    assert ids[2] == str(spam.id)

    monkeypatch.setattr(get_settings(), "AI_TRIAGE_ENABLED", False)
    listed = (await client.get("/v1/reports", headers=_auth(moderator))).json()["items"]
    # Flag off: unchanged newest-first ordering.
    assert [item["id"] for item in listed] == [str(spam.id), str(danger.id), str(crisis.id)]
