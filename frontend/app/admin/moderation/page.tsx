"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { createModerationAction, listModerationActions, listReports } from "@/lib/api/moderation";
import { moderationActions } from "@/lib/constants";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type {
  ModerationActionListResponse,
  ModerationActionType,
  ReportListResponse,
  ReportResponse,
  ReportStatus,
} from "@/lib/types/api";

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  warn:     { bg: "#fef3c7", color: "#92400e" },
  restrict: { bg: "#ede9fe", color: "#5b21b6" },
  suspend:  { bg: "#ffedd5", color: "#9a3412" },
  ban:      { bg: "#fee2e2", color: "#dc2626" },
  dismiss:  { bg: "#f3f4f6", color: "#6b7280" },
};

const REASON_COLORS: Record<string, string> = {
  spam: "#9ca3af",
  harassment: "#dc2626",
  fraud: "#d97706",
  solicitation: "#7c3aed",
  crisis: "#16a34a",
  other: "#6b7280",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface InlineActionFormProps {
  report: ReportResponse;
  onSubmit: (reportId: string, targetUserId: string, action: ModerationActionType, reason: string, durationHours?: number) => Promise<void>;
  acting: boolean;
}

function InlineActionForm({ report, onSubmit, acting }: InlineActionFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<ModerationActionType>("warn");
  const [reason, setReason] = useState(`Report reviewed: ${report.reason}`);
  const [targetUserId, setTargetUserId] = useState(report.reporter_id);
  const [durationHours, setDurationHours] = useState<number | "">("");

  if (!expanded) {
    return (
      <button
        className="ghost"
        type="button"
        onClick={() => setExpanded(true)}
        style={{ fontSize: "12px", padding: "4px 12px" }}
      >
        Take action →
      </button>
    );
  }

  return (
    <div style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "14px", marginTop: "8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <label style={{ fontSize: "12px" }}>
          Action
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as ModerationActionType)}
            style={{ fontSize: "12px", marginTop: "3px" }}
          >
            {moderationActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "12px" }}>
          Target user ID
          <input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            style={{ fontSize: "12px", marginTop: "3px" }}
          />
        </label>
      </div>
      <label style={{ fontSize: "12px", display: "block", marginBottom: "10px" }}>
        Reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          style={{ fontSize: "12px", marginTop: "3px", resize: "vertical" }}
        />
      </label>
      {(action === "suspend" || action === "restrict") && (
        <label style={{ fontSize: "12px", display: "block", marginBottom: "10px" }}>
          Duration (hours)
          <input
            type="number"
            min={1}
            max={8760}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value ? Number(e.target.value) : "")}
            style={{ fontSize: "12px", marginTop: "3px" }}
          />
        </label>
      )}
      <div className="row" style={{ gap: "8px" }}>
        <button
          type="button"
          style={{ fontSize: "12px" }}
          disabled={acting || !reason.trim() || !targetUserId.trim()}
          onClick={() =>
            void onSubmit(
              report.id,
              targetUserId,
              action,
              reason,
              durationHours === "" ? undefined : durationHours
            )
          }
        >
          Confirm
        </button>
        <button
          className="ghost"
          type="button"
          style={{ fontSize: "12px" }}
          onClick={() => setExpanded(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ModerationAdminPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);

  const [reportStatus, setReportStatus] = useState<ReportStatus>("pending");
  const [reports, setReports] = useState<ReportListResponse | null>(null);
  const [actions, setActions] = useState<ModerationActionListResponse | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [reportRes, actionRes] = await Promise.all([
        listReports(token, reportStatus, 1, 30),
        listModerationActions(token, 1, 30),
      ]);
      setReports(reportRes);
      setActions(actionRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load moderation data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reportStatus]);

  async function handleAction(
    reportId: string,
    targetUserId: string,
    action: ModerationActionType,
    reason: string,
    durationHours?: number,
  ) {
    if (!token) return;
    setActingOn(reportId);
    setError(null);
    setSuccess(null);
    try {
      await createModerationAction(token, {
        report_id: reportId,
        target_user_id: targetUserId,
        action,
        reason,
        duration_hours: durationHours,
      });
      setSuccess(`Action "${action}" applied.`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActingOn(null);
    }
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  return (
    <main className="page">
      <section className="card stack" style={{ marginBottom: "16px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>Moderation</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
              Review reports and enforce actions
            </p>
          </div>
          <div className="row" style={{ gap: "8px" }}>
            <button className="ghost" onClick={() => void loadData()} type="button" style={{ fontSize: "13px" }}>
              Refresh
            </button>
            <Link href="/admin/dashboard" className="ghost" style={{ padding: "8px 14px", fontSize: "13px" }}>
              ← Dashboard
            </Link>
          </div>
        </div>
      </section>

      {success && <p className="success" style={{ marginBottom: "12px" }}>{success}</p>}
      {error && <p className="error" style={{ marginBottom: "12px" }}>{error}</p>}

      {/* Report status filter */}
      <div className="row" style={{ gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["pending", "reviewing", "resolved", "dismissed"] as ReportStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setReportStatus(s)}
            style={{
              fontSize: "12px",
              padding: "5px 14px",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              background: reportStatus === s ? "#111827" : "#f3f4f6",
              color: reportStatus === s ? "#fff" : "#374151",
              fontWeight: reportStatus === s ? 700 : 400,
            }}
          >
            {s}
            {s === "pending" && reports && reports.total > 0 && reportStatus !== "pending" && (
              <span style={{ marginLeft: "4px", color: "#dc2626" }}>({reports.total})</span>
            )}
          </button>
        ))}
      </div>

      {/* Reports */}
      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>
          Reports {reports ? `(${reports.total})` : ""}
        </h2>

        {loading ? (
          <div className="card"><p className="muted">Loading…</p></div>
        ) : !reports || reports.items.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ fontSize: "13px" }}>No {reportStatus} reports.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: "10px" }}>
            {reports.items.map((report) => (
              <div key={report.id} className="card stack" style={{ gap: "10px", padding: "16px 20px" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: "#f3f4f6",
                        color: REASON_COLORS[report.reason] ?? "#374151",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 10px",
                        borderRadius: "999px",
                        textTransform: "uppercase",
                      }}
                    >
                      {report.reason}
                    </span>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                      {report.target_type} · {timeAgo(report.created_at)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: report.status === "pending" ? "#d97706" : "#9ca3af",
                      fontWeight: 600,
                    }}
                  >
                    {report.status}
                  </span>
                </div>

                {report.description && (
                  <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>{report.description}</p>
                )}

                <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                  Target: {report.target_id.slice(0, 12)}… · Reporter: {report.reporter_id.slice(0, 12)}…
                </p>

                {report.status === "pending" && (
                  <InlineActionForm
                    report={report}
                    onSubmit={handleAction}
                    acting={actingOn === report.id}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Action history */}
      <section>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>
          Recent actions {actions ? `(${actions.total})` : ""}
        </h2>

        {!actions || actions.items.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ fontSize: "13px" }}>No moderation actions yet.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: "8px" }}>
            {actions.items.map((item) => {
              const ac = ACTION_COLORS[item.action] ?? { bg: "#f3f4f6", color: "#374151" };
              return (
                <div key={item.id} className="card" style={{ padding: "12px 16px" }}>
                  <div className="row" style={{ gap: "10px", alignItems: "center" }}>
                    <span
                      style={{
                        background: ac.bg,
                        color: ac.color,
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 10px",
                        borderRadius: "999px",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {item.action}
                    </span>
                    <span style={{ fontSize: "13px", color: "#374151", flex: 1 }}>{item.reason}</span>
                    <span style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0 }}>
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                  {item.duration_hours && (
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                      Duration: {item.duration_hours}h
                      {item.expires_at ? ` · expires ${timeAgo(item.expires_at)}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
