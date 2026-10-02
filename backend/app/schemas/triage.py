"""AI report triage schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.models.report import ReportReason
from app.models.report_triage import TriageSeverity


class TriageConfigResponse(BaseModel):
    """Whether the AI triage panel should be shown at all."""

    enabled: bool


class TriageDecisionOut(BaseModel):
    """Moderator's recorded decision on a suggestion."""

    decision: str
    final_severity: str
    final_category: str
    decided_by: UUID | None
    decided_at: datetime


class TriageSuggestionOut(BaseModel):
    """AI suggestion as shown to moderators."""

    id: UUID
    report_id: UUID
    provider: str
    model: str
    severity: str
    category: str
    summary: str
    rationale: str
    danger_flag: bool
    created_at: datetime
    cached: bool
    decision: TriageDecisionOut | None = None


class TriageResponse(BaseModel):
    """Result of a triage request.

    ``state``: ``disabled`` (flag off / no key), ``ok`` (suggestion present) or
    ``no_suggestion`` (no content, provider failure, or invalid model output).
    ``urgent`` is true for reason=crisis regardless of the model, or when the
    model flagged self-harm / imminent danger.
    """

    state: Literal["disabled", "ok", "no_suggestion"]
    urgent: bool = False
    suggestion: TriageSuggestionOut | None = None
    message: str | None = None


class TriageDecisionRequest(BaseModel):
    """Moderator's final call. Server derives accepted/overridden."""

    final_severity: TriageSeverity
    final_category: ReportReason


class TriageMetricsResponse(BaseModel):
    """Agreement between AI suggestions and moderator decisions."""

    suggestions: int
    decided: int
    accepted: int
    overridden: int
    agreement_rate: float | None
