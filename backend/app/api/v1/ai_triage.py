"""AI report triage endpoints (moderator assist; the human always decides)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_any_role
from app.core.config import get_settings
from app.core.constants import UserRole
from app.db.session import get_db
from app.models.report_triage import ReportTriage
from app.models.user import User
from app.schemas.triage import (
    TriageConfigResponse,
    TriageDecisionOut,
    TriageDecisionRequest,
    TriageMetricsResponse,
    TriageResponse,
    TriageSuggestionOut,
)
from app.services import triage_service

MODERATION_ROLES = [UserRole.MODERATOR, UserRole.ADMIN, UserRole.HEAD_ADMIN]

router = APIRouter(prefix="/moderation", tags=["moderation"])


def _suggestion_out(triage: ReportTriage, cached: bool) -> TriageSuggestionOut:
    decision = None
    if triage.decided_at is not None and triage.decision and triage.final_severity and triage.final_category:
        decision = TriageDecisionOut(
            decision=triage.decision,
            final_severity=triage.final_severity,
            final_category=triage.final_category,
            decided_by=triage.decided_by,
            decided_at=triage.decided_at,
        )
    return TriageSuggestionOut(
        id=triage.id,
        report_id=triage.report_id,
        provider=triage.provider,
        model=triage.model,
        severity=triage.suggested_severity,
        category=triage.suggested_category,
        summary=triage.summary,
        rationale=triage.rationale,
        danger_flag=triage.danger_flag,
        created_at=triage.created_at,
        cached=cached,
        decision=decision,
    )


@router.get(
    "/triage/config",
    response_model=TriageConfigResponse,
    dependencies=[Depends(require_any_role(MODERATION_ROLES))],
)
async def get_triage_config() -> TriageConfigResponse:
    """Tell the moderation UI whether to render the AI triage panel."""
    return TriageConfigResponse(enabled=get_settings().ai_triage_active)


@router.post(
    "/reports/{report_id}/triage",
    response_model=TriageResponse,
    dependencies=[Depends(require_any_role(MODERATION_ROLES))],
)
async def triage_report(
    report_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TriageResponse:
    """Get (cached) or create an AI suggestion for a report. Never changes report status."""
    outcome = await triage_service.get_or_create_triage(db, current_user, report_id)
    await db.commit()
    return TriageResponse(
        state=outcome.state,
        urgent=outcome.urgent,
        suggestion=_suggestion_out(outcome.triage, outcome.cached) if outcome.triage else None,
        message=outcome.message,
    )


@router.post(
    "/triage/{triage_id}/decision",
    response_model=TriageResponse,
    dependencies=[Depends(require_any_role(MODERATION_ROLES))],
)
async def decide_triage(
    triage_id: UUID,
    payload: TriageDecisionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TriageResponse:
    """Record the moderator's accept/override. The audit row is immutable once written."""
    triage, report = await triage_service.record_decision(
        db, current_user, triage_id, payload.final_severity, payload.final_category
    )
    await db.commit()
    return TriageResponse(
        state="ok",
        urgent=triage_service.is_urgent(report, triage),
        suggestion=_suggestion_out(triage, cached=True),
    )


@router.get(
    "/triage/metrics",
    response_model=TriageMetricsResponse,
    dependencies=[Depends(require_any_role(MODERATION_ROLES))],
)
async def triage_metrics(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TriageMetricsResponse:
    """Agreement between AI suggestions and moderators' final decisions."""
    return TriageMetricsResponse(**await triage_service.get_metrics(db, current_user))
