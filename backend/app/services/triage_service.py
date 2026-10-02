"""AI report triage: suggestion lifecycle, guards, caching and the audit trail.

The AI only suggests. Nothing in here changes a report's status or applies a
moderation action; moderators do that through moderation_service as before.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache
from app.core.config import get_settings
from app.core.constants import UserRole
from app.core.exceptions import (
    DuplicateException,
    ForbiddenException,
    NotFoundException,
    RateLimitException,
)
from app.models.comment import Comment
from app.models.message import Message
from app.models.post import Post
from app.models.report import Report, ReportReason, ReportTargetType
from app.models.report_triage import ReportTriage, TriageDecision, TriageSeverity
from app.models.user import User
from app.services import triage_llm
from app.services.moderation_service import _get_user_or_404, _resolve_target_user_from_report
from app.services.triage_masking import mask_pii

logger = logging.getLogger(__name__)

MODERATION_ROLES = {UserRole.MODERATOR.value, UserRole.ADMIN.value, UserRole.HEAD_ADMIN.value}
ADMIN_ROLES = {UserRole.ADMIN.value, UserRole.HEAD_ADMIN.value}
_RATE_WINDOW_SECONDS = 3600

# Used only when Redis is unreachable, so an outage neither disables triage nor
# removes the per-moderator ceiling. Per-process, so it is approximate.
_local_counts: dict[str, int] = {}


@dataclass
class TriageOutcome:
    """Service result; the route maps it to TriageResponse."""

    state: str
    urgent: bool = False
    triage: ReportTriage | None = None
    cached: bool = False
    message: str | None = None


def _require_moderator(actor: User) -> None:
    if not any(role in MODERATION_ROLES for role in actor.roles):
        raise ForbiddenException("Moderator role required")


async def _guard_report_access(db: AsyncSession, actor: User, report: Report) -> None:
    """Mirror moderation_service's hierarchy guard: moderators cannot touch reports
    about MODERATOR / ADMIN / HEAD_ADMIN users, and nobody triages a report about themselves."""
    target_user_id = await _resolve_target_user_from_report(db, report)
    if target_user_id == actor.id:
        raise ForbiddenException("Moderator cannot triage a report about themselves")
    target_user = await _get_user_or_404(db, target_user_id)
    actor_is_admin = any(role in ADMIN_ROLES for role in actor.roles)
    target_is_privileged = any(role in MODERATION_ROLES for role in target_user.roles)
    if not actor_is_admin and target_is_privileged:
        raise ForbiddenException("Insufficient privileges to triage this report")


async def _load_reported_text(db: AsyncSession, report: Report) -> str:
    """Only the reported content itself. Never names, contact details or reporter data."""
    if report.target_type == ReportTargetType.POST.value:
        row = (await db.execute(select(Post.title, Post.description).where(Post.id == report.target_id))).first()
        return f"{row.title}\n\n{row.description}" if row else ""
    if report.target_type == ReportTargetType.COMMENT.value:
        body = (await db.execute(select(Comment.body).where(Comment.id == report.target_id))).scalar_one_or_none()
        return body or ""
    if report.target_type == ReportTargetType.MESSAGE.value:
        body = (await db.execute(select(Message.body).where(Message.id == report.target_id))).scalar_one_or_none()
        return body or ""
    if report.target_type == ReportTargetType.USER.value:
        bio = (await db.execute(select(User.bio).where(User.id == report.target_id))).scalar_one_or_none()
        return bio or ""
    return ""


def _content_hash(reason: str, masked: str) -> str:
    return hashlib.sha256(f"{triage_llm.PROMPT_VERSION}|{reason}|{masked}".encode()).hexdigest()


async def _consume_rate_limit(actor_id: UUID) -> None:
    limit = get_settings().AI_TRIAGE_RATE_LIMIT_PER_HOUR
    window = int(time.time()) // _RATE_WINDOW_SECONDS
    key = f"ai_triage:rl:{actor_id}:{window}"
    count = await cache.incr_with_ttl(key, _RATE_WINDOW_SECONDS)
    if count is None:
        for stale in [k for k in _local_counts if not k.endswith(f":{window}")]:
            _local_counts.pop(stale, None)
        _local_counts[key] = _local_counts.get(key, 0) + 1
        count = _local_counts[key]
    if count > limit:
        raise RateLimitException("AI triage limit reached for this hour. Try again later.")


async def _get_report(db: AsyncSession, report_id: UUID) -> Report:
    report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
    if not report:
        raise NotFoundException("Report not found")
    return report


def is_urgent(report: Report, triage: ReportTriage | None) -> bool:
    """Deterministic rule: reason=crisis is always urgent; otherwise trust the stored severity."""
    if report.reason == ReportReason.CRISIS.value:
        return True
    return triage is not None and triage.suggested_severity == TriageSeverity.URGENT.value


async def get_or_create_triage(db: AsyncSession, actor: User, report_id: UUID) -> TriageOutcome:
    """Return the cached suggestion for this report version, or ask the LLM for one."""
    _require_moderator(actor)
    if not get_settings().ai_triage_active:
        return TriageOutcome(state="disabled", message="AI triage is disabled")

    report = await _get_report(db, report_id)
    await _guard_report_access(db, actor, report)
    crisis = report.reason == ReportReason.CRISIS.value

    text = await _load_reported_text(db, report)
    if not text.strip():
        return TriageOutcome(state="no_suggestion", urgent=crisis, message="No text content to triage")

    masked = mask_pii(text)[: triage_llm.MAX_CONTENT_CHARS]
    content_hash = _content_hash(report.reason, masked)

    existing = (
        await db.execute(
            select(ReportTriage).where(ReportTriage.report_id == report.id, ReportTriage.content_hash == content_hash)
        )
    ).scalar_one_or_none()
    if existing:
        return TriageOutcome(state="ok", urgent=is_urgent(report, existing), triage=existing, cached=True)

    await _consume_rate_limit(actor.id)
    result = await triage_llm.suggest(masked, report.reason)
    if result is None:
        logger.info("ai_triage: report=%s outcome=no_suggestion", report.id)
        return TriageOutcome(state="no_suggestion", urgent=crisis, message="No AI suggestion available")

    suggestion = result.suggestion
    severity = suggestion.severity
    if crisis or suggestion.imminent_danger:
        severity = TriageSeverity.URGENT.value

    triage = ReportTriage(
        report_id=report.id,
        content_hash=content_hash,
        provider=result.provider,
        model=result.model,
        model_severity=suggestion.severity,
        suggested_severity=severity,
        suggested_category=suggestion.category,
        summary=suggestion.summary,
        rationale=suggestion.rationale,
        danger_flag=suggestion.imminent_danger,
    )
    try:
        async with db.begin_nested():
            db.add(triage)
            await db.flush()
    except IntegrityError:
        # Another moderator triaged the same version concurrently; use theirs.
        triage = (
            await db.execute(
                select(ReportTriage).where(
                    ReportTriage.report_id == report.id, ReportTriage.content_hash == content_hash
                )
            )
        ).scalar_one()
        return TriageOutcome(state="ok", urgent=is_urgent(report, triage), triage=triage, cached=True)

    await db.refresh(triage)
    logger.info("ai_triage: report=%s outcome=ok severity=%s", report.id, triage.suggested_severity)
    return TriageOutcome(state="ok", urgent=is_urgent(report, triage), triage=triage)


async def record_decision(
    db: AsyncSession,
    actor: User,
    triage_id: UUID,
    final_severity: TriageSeverity,
    final_category: ReportReason,
) -> tuple[ReportTriage, Report]:
    """Store the moderator's final call. One decision per suggestion (immutable audit)."""
    _require_moderator(actor)
    triage = (await db.execute(select(ReportTriage).where(ReportTriage.id == triage_id))).scalar_one_or_none()
    if not triage:
        raise NotFoundException("Triage suggestion not found")
    report = await _get_report(db, triage.report_id)
    await _guard_report_access(db, actor, report)
    agreed = final_severity.value == triage.suggested_severity and final_category.value == triage.suggested_category
    # Check-and-write in one conditional UPDATE so two concurrent decisions
    # cannot both pass a Python-side check and overwrite each other.
    result = await db.execute(
        update(ReportTriage)
        .where(ReportTriage.id == triage.id, ReportTriage.decided_at.is_(None))
        .values(
            decision=(TriageDecision.ACCEPTED if agreed else TriageDecision.OVERRIDDEN).value,
            final_severity=final_severity.value,
            final_category=final_category.value,
            decided_by=actor.id,
            decided_at=datetime.now(UTC),
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:
        raise DuplicateException("A decision was already recorded for this suggestion")
    await db.refresh(triage)
    return triage, report


async def get_metrics(db: AsyncSession, actor: User) -> dict[str, int | float | None]:
    """Agreement metric: share of decided suggestions moderators accepted unchanged."""
    _require_moderator(actor)
    total = (await db.execute(select(func.count(ReportTriage.id)))).scalar_one()
    rows = await db.execute(
        select(ReportTriage.decision, func.count(ReportTriage.id))
        .where(ReportTriage.decision.is_not(None))
        .group_by(ReportTriage.decision)
    )
    by_decision = {row[0]: row[1] for row in rows.all()}
    accepted = by_decision.get(TriageDecision.ACCEPTED.value, 0)
    overridden = by_decision.get(TriageDecision.OVERRIDDEN.value, 0)
    decided = accepted + overridden
    return {
        "suggestions": total,
        "decided": decided,
        "accepted": accepted,
        "overridden": overridden,
        "agreement_rate": round(accepted / decided, 3) if decided else None,
    }
