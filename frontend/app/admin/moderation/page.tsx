"use client";

import { FormEvent, useEffect, useState } from "react";

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
  ReportStatus
} from "@/lib/types/api";

export default function ModerationAdminPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [reportStatus, setReportStatus] = useState<ReportStatus>("pending");
  const [reports, setReports] = useState<ReportListResponse | null>(null);
  const [actions, setActions] = useState<ModerationActionListResponse | null>(null);

  const [reportId, setReportId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [actionType, setActionType] = useState<ModerationActionType>("warn");
  const [reason, setReason] = useState("Policy violation reviewed by moderation panel");
  const [durationHours, setDurationHours] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [reportResponse, actionResponse] = await Promise.all([
        listReports(token, reportStatus, 1, 30),
        listModerationActions(token, 1, 30)
      ]);
      setReports(reportResponse);
      setActions(actionResponse);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load moderation data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reportStatus]);

  async function handleCreateAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    if (!reportId.trim() && !targetUserId.trim()) {
      setError("Provide report_id or target_user_id");
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await createModerationAction(token, {
        report_id: reportId.trim() || undefined,
        target_user_id: targetUserId.trim() || undefined,
        action: actionType,
        reason,
        duration_hours: durationHours === "" ? undefined : Number(durationHours)
      });
      setMessage("Moderation action created.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create moderation action");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <section className="card stack">
            <h1>Reports & Moderation (Module 6)</h1>
            <p className="muted">Review reports and enforce moderation actions.</p>
            <div className="row">
              <label>
                Report status
                <select
                  value={reportStatus}
                  onChange={(event) => setReportStatus(event.target.value as ReportStatus)}
                >
                  <option value="pending">pending</option>
                  <option value="reviewing">reviewing</option>
                  <option value="resolved">resolved</option>
                  <option value="dismissed">dismissed</option>
                </select>
              </label>
              <button className="ghost" onClick={() => void loadData()} type="button">
                Refresh
              </button>
            </div>
          </section>

          <section className="card stack">
            <h3>Create Moderation Action</h3>
            <form className="grid" onSubmit={handleCreateAction}>
              <label>
                Report ID (optional)
                <input value={reportId} onChange={(event) => setReportId(event.target.value)} />
              </label>
              <label>
                Target User ID (optional)
                <input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} />
              </label>
              <label>
                Action
                <select
                  value={actionType}
                  onChange={(event) => setActionType(event.target.value as ModerationActionType)}
                >
                  {moderationActions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <label>
                Duration hours (optional)
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={durationHours}
                  onChange={(event) => setDurationHours(event.target.value ? Number(event.target.value) : "")}
                />
              </label>
              <button type="submit">Create Action</button>
            </form>
          </section>

          {loading ? <p className="muted">Loading...</p> : null}
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <section className="card stack">
            <h3>Reports</h3>
            <div className="stack">
              {reports?.items.map((report) => (
                <article className="card" key={report.id}>
                  <p style={{ marginTop: 0 }}>
                    <strong>{report.id}</strong>
                  </p>
                  <p className="muted">
                    {report.target_type} · {report.reason} · {report.status}
                  </p>
                  <p>{report.description ?? "No description"}</p>
                </article>
              ))}
              {!loading && reports && reports.items.length === 0 ? (
                <p className="muted">No reports for selected status.</p>
              ) : null}
            </div>
          </section>

          <section className="card stack">
            <h3>Moderation Action History</h3>
            <div className="stack">
              {actions?.items.map((item) => (
                <article className="card" key={item.id}>
                  <p style={{ marginTop: 0 }}>
                    <strong>{item.action}</strong> on {item.target_user_id}
                  </p>
                  <p className="muted">
                    report: {item.report_id ?? "-"} · duration: {item.duration_hours ?? "-"}h
                  </p>
                  <p>{item.reason}</p>
                </article>
              ))}
              {!loading && actions && actions.items.length === 0 ? (
                <p className="muted">No moderation actions yet.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
