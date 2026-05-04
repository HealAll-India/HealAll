"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthRequired } from "@/components/ui/auth-required";
import { addCaseNote, closeCase, getCase, listCaseNotes, offerHelp, reopenCase } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CaseNoteResponse, CaseResponse } from "@/lib/types/api";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open:            { bg: "#dbeafe", color: "#1d4ed8" },
  in_progress:     { bg: "#fef3c7", color: "#92400e" },
  pending_closure: { bg: "#ffedd5", color: "#9a3412" },
  closed:          { bg: "#f3f4f6", color: "#6b7280" },
  invalid:         { bg: "#fee2e2", color: "#dc2626" },
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high:     "#d97706",
  medium:   "#2563eb",
  low:      "#6b7280",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "3px 12px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTIVE_STATUSES = new Set(["open", "in_progress"]);
const RESOLUTION_OPTIONS = [
  { value: "resolved",  label: "Resolved — support provided" },
  { value: "stale",     label: "Stale — no activity" },
  { value: "invalid",   label: "Invalid — not a real request" },
  { value: "withdrawn", label: "Withdrawn — requester withdrew" },
] as const;

type ResolutionType = "resolved" | "stale" | "invalid" | "withdrawn";

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);

  const [caseDetail, setCaseDetail] = useState<CaseResponse | null>(null);
  const [notes, setNotes] = useState<CaseNoteResponse[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [closureRemarks, setClosureRemarks] = useState("");
  const [resolutionType, setResolutionType] = useState<ResolutionType>("resolved");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, caseNotes] = await Promise.all([
        getCase(token, caseId),
        listCaseNotes(token, caseId),
      ]);
      setCaseDetail(detail);
      setNotes(caseNotes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load case");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, caseId]);

  async function withAction(fn: () => Promise<void>) {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOfferHelp() {
    await withAction(async () => {
      await offerHelp(token!, caseId);
      setSuccess("You've offered to help — the case owner will be notified.");
      await loadData();
    }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to offer help"));
  }

  async function handleReopen() {
    await withAction(async () => {
      const updated = await reopenCase(token!, caseId);
      setCaseDetail(updated);
      setSuccess("Case reopened.");
    }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to reopen case"));
  }

  async function handleAddNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    await withAction(async () => {
      const note = await addCaseNote(token!, caseId, { body: noteBody.trim() });
      setNotes((prev) => [...prev, note]);
      setNoteBody("");
      setSuccess("Note added.");
    }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to add note"));
  }

  async function handleClose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!closureRemarks.trim()) return;
    await withAction(async () => {
      await closeCase(token!, caseId, {
        closure_remarks: closureRemarks.trim(),
        resolution_type: resolutionType,
        impact_consent: false,
      });
      setSuccess("Closure requested.");
      await loadData();
    }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to request closure"));
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  const isActive = caseDetail ? ACTIVE_STATUSES.has(caseDetail.status) : false;
  const isClosed = caseDetail?.status === "closed";

  return (
    <main className="page">
      {/* Back */}
      <div style={{ marginBottom: "12px" }}>
        <Link href="/cases" style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>
          ← All cases
        </Link>
      </div>

      {loading && !caseDetail ? (
        <section className="card"><p className="muted">Loading case…</p></section>
      ) : error && !caseDetail ? (
        <section className="card"><p className="error">{error}</p></section>
      ) : caseDetail ? (
        <>
          {/* Header */}
          <section className="card stack" style={{ marginBottom: "16px", gap: "12px" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, lineHeight: 1.3 }}>
                {caseDetail.post.title}
              </h1>
              <StatusBadge status={caseDetail.status} />
            </div>

            <div className="row" style={{ gap: "14px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>📍 {caseDetail.post.city}</span>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>🏷 {caseDetail.post.category}</span>
              <span style={{ fontSize: "13px", color: URGENCY_COLORS[caseDetail.post.urgency] ?? "#6b7280", fontWeight: 600 }}>
                ⚡ {caseDetail.post.urgency}
              </span>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>
                🙋 {caseDetail.helper_count} helper{caseDetail.helper_count !== 1 ? "s" : ""}
              </span>
            </div>

            {caseDetail.owner && (
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                Managed by <strong style={{ color: "#374151" }}>{caseDetail.owner.name}</strong>
              </p>
            )}

            {/* Actions */}
            {isActive && (
              <div className="row" style={{ gap: "8px", marginTop: "4px" }}>
                <button onClick={handleOfferHelp} disabled={actionLoading} type="button">
                  🙋 Offer Help
                </button>
              </div>
            )}
            {isClosed && (
              <div className="row" style={{ gap: "8px", marginTop: "4px" }}>
                <button className="ghost" onClick={handleReopen} disabled={actionLoading} type="button">
                  Reopen Case
                </button>
              </div>
            )}

            {success && <p className="success" style={{ margin: 0 }}>{success}</p>}
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          </section>

          {/* Notes */}
          <section className="card stack" style={{ marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Case notes</h2>

            {notes.length === 0 ? (
              <p className="muted" style={{ fontSize: "13px" }}>No notes yet.</p>
            ) : (
              <div className="stack" style={{ gap: "8px" }}>
                {notes.map((note) => (
                  <div
                    key={note.id}
                    style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "12px 14px" }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>{note.body}</p>
                    <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                      {note.author.name} · {timeAgo(note.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form className="stack" onSubmit={handleAddNote} style={{ gap: "8px", marginTop: "4px" }}>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a case note…"
                rows={3}
                style={{ resize: "vertical" }}
              />
              <button type="submit" className="ghost" disabled={actionLoading || !noteBody.trim()}>
                Add note
              </button>
            </form>
          </section>

          {/* Closure — only shown for non-closed cases */}
          {!isClosed && (
            <section className="card stack">
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Request closure</h2>
              <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
                Case owners and admins can close a case. A second party confirms.
              </p>
              <form className="stack" onSubmit={handleClose} style={{ gap: "10px" }}>
                <label>
                  Resolution type
                  <select
                    value={resolutionType}
                    onChange={(e) => setResolutionType(e.target.value as ResolutionType)}
                  >
                    {RESOLUTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Closure remarks
                  <textarea
                    value={closureRemarks}
                    onChange={(e) => setClosureRemarks(e.target.value)}
                    placeholder="Describe how this case was resolved…"
                    rows={3}
                    style={{ resize: "vertical" }}
                    required
                  />
                </label>
                <button type="submit" className="ghost" disabled={actionLoading || !closureRemarks.trim()}>
                  Request closure
                </button>
              </form>
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}
