"""Schemas for admin-only endpoints."""

from datetime import date

from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    total_users: int
    verified_users: int
    suspended_users: int
    active_posts: int
    open_cases: int
    pending_verifications: int
    pending_reports: int


class Under18SummaryResponse(BaseModel):
    """Accounts made at 13 to 17. Counts only, no member details."""

    total: int
    not_warned: int
    waiting: int
    due: int
    staff: int
    next_close_on: date | None


class Under18WarnResponse(BaseModel):
    sent: int
    failed: int
    close_on: date | None


class Under18CloseResponse(BaseModel):
    closed: int
