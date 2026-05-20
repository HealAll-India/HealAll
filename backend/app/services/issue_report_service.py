"""Issue-report fan-out service.

Submits a public landing-page feedback report to two best-effort sinks:
maintainer email (via the existing notification provider) and a GitHub
Issue on the configured repo. Both branches run concurrently; one failing
does not abort the other. The caller surfaces ``partial=True`` when either
sink failed, but never raises.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from app.core.config import get_settings
from app.services.notification_service import send_email

logger = logging.getLogger(__name__)

_GITHUB_API = "https://api.github.com"
_HTTP_TIMEOUT_SECONDS = 10.0


def _build_subject(description: str) -> str:
    stripped = description.strip()
    lines = stripped.splitlines()
    snippet = (lines[0] if lines else stripped)[:60]
    return f"[HealAll Issue Report] {snippet}"


def _build_email_body(
    description: str,
    contact_email: str | None,
    page_url: str | None,
    client_ip: str | None,
) -> str:
    lines = ["A new issue report was submitted from the landing page.", ""]
    if contact_email:
        lines.append(f"Contact email: {contact_email}")
    if page_url:
        lines.append(f"Page URL: {page_url}")
    if client_ip:
        lines.append(f"Client IP: {client_ip}")
    lines += ["", "Description:", description.strip()]
    return "\n".join(lines)


def _build_github_body(
    description: str,
    contact_email: str | None,
    page_url: str | None,
) -> str:
    # Use a unique fence so an attacker can't break out by embedding triple-backticks.
    fence = "~~~"
    safe = description.strip().replace(fence, "~~ ~")
    parts = ["Reported via the landing-page feedback form.", ""]
    if contact_email:
        parts.append(f"- **Contact email:** {contact_email}")
    if page_url:
        parts.append(f"- **Page URL:** {page_url}")
    parts += ["", "**Description:**", "", fence, safe, fence]
    return "\n".join(parts)


async def _send_email_branch(
    description: str,
    contact_email: str | None,
    page_url: str | None,
    client_ip: str | None,
) -> bool:
    settings = get_settings()
    if not settings.ISSUE_REPORT_EMAIL_TO:
        logger.info("issue_report: ISSUE_REPORT_EMAIL_TO unset, skipping email branch")
        return False
    subject = _build_subject(description)
    body = _build_email_body(description, contact_email, page_url, client_ip)
    try:
        ok = await send_email(settings.ISSUE_REPORT_EMAIL_TO, subject, body)
    except Exception:  # noqa: BLE001
        logger.exception("issue_report: email branch raised")
        return False
    logger.info("issue_report: email branch ok=%s", ok)
    return bool(ok)


async def _create_github_issue(
    description: str,
    contact_email: str | None,
    page_url: str | None,
) -> str | None:
    settings = get_settings()
    if not settings.GITHUB_TOKEN:
        logger.info("issue_report: GITHUB_TOKEN unset, skipping GitHub branch")
        return None
    title = _build_subject(description)
    payload = {
        "title": title,
        "body": _build_github_body(description, contact_email, page_url),
        "labels": ["user-report"],
    }
    url = f"{_GITHUB_API}/repos/{settings.GITHUB_REPO}/issues"
    headers = {
        "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "healall-issue-report/1.0",
    }
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError:
        logger.exception("issue_report: GitHub branch network error")
        return None
    if resp.status_code >= 300:
        # Do not log resp.text — the GitHub API echoes parts of the submitted
        # payload (which may include the user's contact_email and description),
        # so writing it to logs would leak PII for a public input path.
        logger.warning(
            "issue_report: GitHub branch failed status=%s request_id=%s",
            resp.status_code,
            resp.headers.get("x-github-request-id"),
        )
        return None
    try:
        data = resp.json()
    except ValueError:
        logger.exception("issue_report: GitHub branch returned non-JSON body")
        return None
    issue_url = data.get("html_url") if isinstance(data, dict) else None
    logger.info("issue_report: GitHub branch ok url=%s", issue_url)
    return issue_url


async def submit_issue_report(
    description: str,
    contact_email: str | None,
    page_url: str | None,
    client_ip: str | None,
) -> dict[str, object]:
    """Fan out one issue report to email + GitHub. Best-effort; never raises."""
    results = await asyncio.gather(
        _send_email_branch(description, contact_email, page_url, client_ip),
        _create_github_issue(description, contact_email, page_url),
        return_exceptions=True,
    )

    email_result, github_result = results
    if isinstance(email_result, BaseException):
        logger.exception("issue_report: email branch raised in gather", exc_info=email_result)
        email_ok = False
    else:
        email_ok = bool(email_result)

    if isinstance(github_result, BaseException):
        logger.exception("issue_report: GitHub branch raised in gather", exc_info=github_result)
        issue_url: str | None = None
    else:
        issue_url = github_result  # type: ignore[assignment]

    return {
        "email_ok": email_ok,
        "github_ok": issue_url is not None,
        "issue_url": issue_url,
    }
