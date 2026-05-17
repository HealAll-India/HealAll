"""Schemas for admin-only endpoints."""

from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    total_users: int
    verified_users: int
    suspended_users: int
    active_posts: int
    open_cases: int
    pending_verifications: int
    pending_reports: int
