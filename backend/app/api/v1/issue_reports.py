"""Public landing-page issue report endpoint (no auth)."""

from __future__ import annotations

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, EmailStr, Field, HttpUrl

from app.core.limiter import limiter
from app.services.issue_report_service import submit_issue_report

router = APIRouter(prefix="/issue-reports", tags=["issue-reports"])


class IssueReportIn(BaseModel):
    description: str = Field(min_length=10, max_length=2000)
    contact_email: EmailStr | None = None
    page_url: HttpUrl | None = None
    # Honeypot: real users never fill this. Must be empty.
    website: str = Field(default="", max_length=0)


class IssueReportOut(BaseModel):
    ok: bool
    partial: bool = False
    issue_url: str | None = None


@router.post("", response_model=IssueReportOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def create_issue_report(request: Request, payload: IssueReportIn) -> IssueReportOut:
    if payload.website:
        # Bot tripped the honeypot — silently accept and drop.
        return IssueReportOut(ok=True, partial=False)

    client_ip = request.client.host if request.client else None
    result = await submit_issue_report(
        description=payload.description,
        contact_email=payload.contact_email,
        page_url=str(payload.page_url) if payload.page_url else None,
        client_ip=client_ip,
    )
    email_ok = bool(result["email_ok"])
    github_ok = bool(result["github_ok"])
    partial = not (email_ok and github_ok)
    issue_url = result["issue_url"] if isinstance(result["issue_url"], str) else None
    return IssueReportOut(ok=True, partial=partial, issue_url=issue_url)
