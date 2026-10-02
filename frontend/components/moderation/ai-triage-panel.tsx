"use client";

import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { decideTriage, triageReport } from "@/lib/api/moderation";
import { reportReasons } from "@/lib/constants";
import type { ReportReason, ReportResponse, TriageResponse, TriageSeverity } from "@/lib/types/api";

const SEVERITIES: TriageSeverity[] = ["low", "medium", "high", "urgent"];

interface AiTriagePanelProps {
  token: string;
  report: ReportResponse;
  /** Lets the page float urgent reports to the top once the AI flags one. */
  onUrgent: (reportId: string) => void;
}

/**
 * AI triage suggestion for one report. Suggest-only: nothing here changes the
 * report or applies an action. The moderator's accept/override is stored for audit.
 */
export function AiTriagePanel({ token, report, onUrgent }: AiTriagePanelProps) {
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [finalSeverity, setFinalSeverity] = useState<TriageSeverity>("medium");
  const [finalCategory, setFinalCategory] = useState<ReportReason>("other");

  const crisis = report.reason === "crisis";
  const suggestion = result?.suggestion ?? null;
  const urgent = crisis || Boolean(result?.urgent);

  async function runTriage() {
    setLoading(true);
    setError(null);
    try {
      const res = await triageReport(token, report.id);
      setResult(res);
      if (res.suggestion) {
        setFinalSeverity(res.suggestion.severity);
        setFinalCategory(res.suggestion.category);
      }
      if (res.urgent) onUrgent(report.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "AI triage failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveDecision(severity: TriageSeverity, category: ReportReason) {
    if (!suggestion) return;
    setSaving(true);
    setError(null);
    try {
      setResult(await decideTriage(token, suggestion.id, { final_severity: severity, final_category: category }));
      setOverriding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save decision");
    } finally {
      setSaving(false);
    }
  }

  if (result?.state === "disabled") return null;

  return (
    <section className={`ai-triage${urgent ? " ai-triage--urgent" : ""}`} aria-label="AI triage suggestion">
      <div className="ai-triage__head">
        <span className="ai-triage__title">AI triage</span>
        {urgent && <span className="ai-triage__badge ai-triage__badge--urgent">Urgent</span>}
        {!result && (
          <button type="button" className="ghost ai-triage__run" disabled={loading} onClick={() => void runTriage()}>
            {loading ? "Analysing…" : "Get suggestion"}
          </button>
        )}
      </div>

      {crisis && !suggestion && (
        <p className="ai-triage__note">Crisis report: always treated as urgent. Review this first.</p>
      )}

      {result?.state === "no_suggestion" && (
        <p className="ai-triage__note">No AI suggestion available{result.message ? ` (${result.message})` : ""}.</p>
      )}

      {suggestion && (
        <>
          <div className="ai-triage__tags">
            <span className={`ai-triage__badge ai-triage__badge--${suggestion.severity}`}>
              Severity: {suggestion.severity}
            </span>
            <span className="ai-triage__badge">Category: {suggestion.category}</span>
            {suggestion.danger_flag && (
              <span className="ai-triage__badge ai-triage__badge--urgent">Possible self-harm / danger</span>
            )}
          </div>
          <p className="ai-triage__summary">{suggestion.summary}</p>
          <p className="ai-triage__rationale">Why: {suggestion.rationale}</p>
          <p className="ai-triage__meta">
            Suggestion only. It takes no action and does not change the report. {suggestion.model}
            {suggestion.cached ? " · cached" : ""}
          </p>

          {suggestion.decision ? (
            <p className="ai-triage__decided">
              You {suggestion.decision.decision === "accepted" ? "accepted" : "overrode"} this:{" "}
              {suggestion.decision.final_severity} / {suggestion.decision.final_category}
            </p>
          ) : overriding ? (
            <div className="ai-triage__override">
              <label>
                Severity
                <select value={finalSeverity} onChange={(e) => setFinalSeverity(e.target.value as TriageSeverity)}>
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select value={finalCategory} onChange={(e) => setFinalCategory(e.target.value as ReportReason)}>
                  {reportReasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
              <div className="row ai-triage__actions">
                <button type="button" disabled={saving} onClick={() => void saveDecision(finalSeverity, finalCategory)}>
                  Save my call
                </button>
                <button type="button" className="ghost" onClick={() => setOverriding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="row ai-triage__actions">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDecision(suggestion.severity, suggestion.category)}
              >
                Agree
              </button>
              <button type="button" className="ghost" onClick={() => setOverriding(true)}>
                Override
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="error ai-triage__error">{error}</p>}
    </section>
  );
}
