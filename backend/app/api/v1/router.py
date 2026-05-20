"""Main v1 router aggregating all routes."""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    cases,
    comments,
    community_verification,
    feed,
    google_auth,
    invites,
    issue_reports,
    messages,
    moderation,
    posts,
    reports,
    uploads,
    users,
    verification,
)

router = APIRouter(prefix="/v1")

router.include_router(auth.router)
router.include_router(google_auth.router)
router.include_router(invites.router)
router.include_router(users.router)
router.include_router(posts.router)
router.include_router(comments.router)
router.include_router(feed.router)
router.include_router(verification.router)
router.include_router(community_verification.router)
router.include_router(cases.router)
router.include_router(messages.router)
router.include_router(reports.router)
router.include_router(moderation.router)
router.include_router(uploads.router)
router.include_router(admin.router)
router.include_router(issue_reports.router)
