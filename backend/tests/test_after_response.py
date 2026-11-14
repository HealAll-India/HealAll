"""after_response: background work must still happen on AWS Lambda.

Lambda freezes the process once the response is returned, so a FastAPI
background task (an OTP email) would wait for the next request to thaw it.
"""

import asyncio
import logging

import pytest
from fastapi import BackgroundTasks
from httpx import AsyncClient

from app.core import after_response as after_response_module
from app.core.after_response import after_response, runs_on_lambda
from app.services import notification_service


@pytest.fixture
def on_lambda(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "healall-api-test")


@pytest.fixture
def off_lambda(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AWS_LAMBDA_FUNCTION_NAME", raising=False)


async def test_off_lambda_the_work_waits_for_the_response(off_lambda: None) -> None:
    calls: list[str] = []

    async def send(to: str) -> None:
        calls.append(to)

    tasks = BackgroundTasks()
    await after_response(tasks, send, "a@example.com")

    assert not runs_on_lambda()
    assert calls == []
    assert len(tasks.tasks) == 1


async def test_on_lambda_the_work_runs_before_the_response(on_lambda: None) -> None:
    calls: list[str] = []

    async def send(to: str) -> None:
        calls.append(to)

    tasks = BackgroundTasks()
    await after_response(tasks, send, "a@example.com")

    assert runs_on_lambda()
    assert calls == ["a@example.com"]
    assert tasks.tasks == []


async def test_on_lambda_a_failed_send_does_not_fail_the_request(
    on_lambda: None, caplog: pytest.LogCaptureFixture
) -> None:
    async def send(to: str) -> None:
        raise RuntimeError("provider down")

    with caplog.at_level(logging.ERROR):
        await after_response(BackgroundTasks(), send, "a@example.com")

    assert "send failed" in caplog.text


async def test_on_lambda_a_hung_send_is_cut_off(
    on_lambda: None, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(after_response_module, "SEND_DEADLINE_SECONDS", 0.05)

    async def send(to: str) -> None:
        await asyncio.sleep(5)

    with caplog.at_level(logging.ERROR):
        await asyncio.wait_for(after_response(BackgroundTasks(), send, "a@example.com"), timeout=1)

    assert "send failed" in caplog.text


async def test_on_lambda_resend_otp_sends_before_answering(
    client: AsyncClient, on_lambda: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[tuple[str, str]] = []

    async def fake_send_otp_email(email: str, otp_code: str, purpose: str = "verification") -> None:
        sent.append((email, purpose))

    monkeypatch.setattr(notification_service, "send_otp_email", fake_send_otp_email)
    # The test client waits for background tasks before returning, so record
    # (and never run) anything queued: on Lambda nothing may be left for later.
    queued: list[str] = []

    def record(_self: BackgroundTasks, func, *_args, **_kwargs) -> None:  # noqa: ANN001
        queued.append(func.__name__)

    monkeypatch.setattr(BackgroundTasks, "add_task", record)

    response = await client.post("/v1/auth/resend-otp", json={"phone_or_email": "member@example.com"})

    assert response.status_code == 200, response.text
    assert queued == []
    assert sent == [("member@example.com", "login")]
