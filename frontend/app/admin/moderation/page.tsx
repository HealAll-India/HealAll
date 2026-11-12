"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Inbox, RefreshCw } from "lucide-react";

import { StaffOnly } from "@/components/admin/staff-only";
import { canOpenStaffPage } from "@/components/layout/nav-config";
import { ActionHistory } from "@/components/moderation/action-history";
import { ReportCard } from "@/components/moderation/report-card";
import { AuthRequired } from "@/components/ui/auth-required";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import {
  createModerationAction,
  getTriageConfig,
  listModerationActions,
  listReports,
} from "@/lib/api/moderation";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type {
  ModerationActionListResponse,
  ModerationActionType,
  ReportListResponse,
  ReportResponse,
  ReportStatus,
} from "@/lib/types/api";
import { actionMeta } from "@/lib/ui/moderation-meta";

const NO_ROLES: readonly string[] = [];
const PAGE_SIZE = 30;

const STATUSES: readonly { value: ReportStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function ReportsSkeleton() {
  return (
    <div className="report-list" role="status" aria-live="polite">
      <span className="sr-only">Loading reports…</span>
      {[0, 1].map((i) => (
        <div key={i} className="report-card" aria-hidden="true">
          <div className="row">
            <Skeleton className="skeleton--pill" />
            <Skeleton width="120px" />
          </div>
          <Skeleton width="100%" />
          <Skeleton width="60%" />
        </div>
      ))}
    </div>
  );
}

export default function ModerationAdminPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const roles = useAuthStore((s) => s.user?.roles) ?? NO_ROLES;
  const allowed = canOpenStaffPage("/admin/moderation", roles);

  const [reportStatus, setReportStatus] = useState<ReportStatus>("pending");
  // null while the current filter loads.
  const [reports, setReports] = useState<ReportListResponse | null>(null);
  const [actions, setActions] = useState<ModerationActionListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [triageEnabled, setTriageEnabled] = useState(false);
  const [aiUrgentIds, setAiUrgentIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!token || !allowed) return;
    // Any failure (flag off, older backend) means no panel at all.
    getTriageConfig(token)
      .then((res) => setTriageEnabled(res.enabled))
      .catch(() => setTriageEnabled(false));
  }, [token, allowed]);

  useEffect(() => {
    if (!token || !allowed) return;
    let current = true;
    Promise.all([listReports(token, reportStatus, 1, PAGE_SIZE), listModerationActions(token, 1, PAGE_SIZE)])
      .then(([reportRes, actionRes]) => {
        if (!current) return;
        setReports(reportRes);
        setActions(actionRes);
      })
      .catch((err) => {
        if (current) setLoadError(messageOf(err, "We couldn't load reports."));
      });
    return () => {
      current = false;
    };
  }, [token, allowed, reportStatus, reloads]);

  function markUrgent(reportId: string) {
    setAiUrgentIds((prev) => (prev.has(reportId) ? prev : new Set(prev).add(reportId)));
  }

  // Crisis reports and AI-flagged urgent ones float to the top (stable sort).
  const isUrgent = (r: ReportResponse) => r.reason === "crisis" || aiUrgentIds.has(r.id);
  const sortedReports = reports
    ? triageEnabled
      ? [...reports.items].sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)))
      : reports.items
    : [];

  function chooseStatus(next: ReportStatus) {
    if (next === reportStatus) return;
    setReports(null);
    setLoadError(null);
    setReportStatus(next);
  }

  function reload() {
    setLoadError(null);
    setReloads((n) => n + 1);
  }

  // An empty targetUserId lets the API resolve the reported member from the report.
  async function handleAction(
    reportId: string,
    targetUserId: string,
    action: ModerationActionType,
    reason: string,
    durationHours?: number,
  ) {
    if (!token) return;
    setActingOn(reportId);
    setActionError(null);
    setDone(null);
    try {
      await createModerationAction(token, {
        report_id: reportId,
        target_user_id: targetUserId.trim() || undefined,
        action,
        reason,
        duration_hours: durationHours,
      });
      setDone(actionMeta(action).done);
      // The action resolves or dismisses the report, so it leaves this list now.
      setReports((prev) =>
        prev && reportStatus === "pending"
          ? { ...prev, items: prev.items.filter((r) => r.id !== reportId), total: Math.max(0, prev.total - 1) }
          : prev,
      );
      reload();
    } catch (err) {
      setActionError(messageOf(err, "That action didn't go through. Try again."));
    } finally {
      setActingOn(null);
    }
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  const statusLabel = STATUSES.find((s) => s.value === reportStatus)?.label ?? reportStatus;

  return (
    <main className="page admin-page">
      <PageHeader
        title="Moderation"
        subtitle="Reports from members. Actions land on the reported member, never the reporter."
        actions={
          allowed ? (
            <button type="button" className="ghost btn-sm" onClick={reload} disabled={reports === null && !loadError}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          ) : null
        }
      />

      {!allowed ? (
        <StaffOnly who="moderators" />
      ) : (
        <div className="admin-sections">
          {done ? (
            <div className="notice notice--success" role="status">
              <CircleCheck size={18} aria-hidden="true" />
              <p>{done}</p>
            </div>
          ) : null}
          {actionError ? (
            <div className="notice notice--error" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <p>{actionError}</p>
            </div>
          ) : null}

          <section className="admin-section" aria-labelledby="reports-title">
            <div className="admin-section__head">
              <h2 id="reports-title" className="section-title">
                Reports
              </h2>
              {reports ? <span className="admin-count">{reports.total.toLocaleString("en-IN")}</span> : null}
            </div>
            <div className="chip-rail" role="group" aria-label="Show reports that are">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="chip-toggle"
                  aria-pressed={reportStatus === s.value}
                  onClick={() => chooseStatus(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {loadError ? (
              <div className="notice notice--error" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <p>{loadError}</p>
                <button type="button" className="ghost btn-sm" onClick={reload}>
                  Try again
                </button>
              </div>
            ) : reports === null ? (
              <ReportsSkeleton />
            ) : sortedReports.length === 0 ? (
              <EmptyState Icon={Inbox} title={`No ${statusLabel.toLowerCase()} reports`}>
                {reportStatus === "pending" ? "You're all caught up. New reports from members appear here." : null}
              </EmptyState>
            ) : (
              <ul className="report-list">
                {sortedReports.map((report) => (
                  <li key={report.id}>
                    <ReportCard
                      token={token}
                      report={report}
                      triageEnabled={triageEnabled}
                      onUrgent={markUrgent}
                      onAct={handleAction}
                      acting={actingOn === report.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {actions ? (
            <section className="admin-section" aria-labelledby="history-title">
              <div className="admin-section__head">
                <h2 id="history-title" className="section-title">
                  Recent actions
                </h2>
                <span className="admin-count">{actions.total.toLocaleString("en-IN")}</span>
              </div>
              <ActionHistory actions={actions.items} />
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
