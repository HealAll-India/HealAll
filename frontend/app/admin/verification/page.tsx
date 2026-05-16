"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { rejectPost, requestInfo, verifyPost, getVerificationQueue } from "@/lib/api/verification";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { VerificationQueueItem } from "@/lib/types/api";

const URGENCY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high:     "#d97706",
  medium:   "#2563eb",
  low:      "#6b7280",
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

interface QueueCardProps {
  item: VerificationQueueItem;
  remarks: string;
  onRemarksChange: (val: string) => void;
  onAct: (action: "verify" | "request-info" | "reject") => void;
  acting: boolean;
}

function QueueCard({ item, remarks, onRemarksChange, onAct, acting }: QueueCardProps) {
  return (
    <div className="card stack" style={{ gap: "12px", padding: "18px 20px" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ flex: 1 }}>
          <Link href={`/posts/${item.post_id}`} style={{ textDecoration: "none" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>
              {item.title}
            </h3>
          </Link>
          <div className="row" style={{ gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>📍 {item.city}</span>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>🏷 {item.category}</span>
            <span style={{ fontSize: "12px", color: URGENCY_COLORS[item.urgency] ?? "#6b7280", fontWeight: 600 }}>
              ⚡ {item.urgency}
            </span>
          </div>
        </div>
        <span style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0 }}>
          {timeAgo(item.submitted_at)}
        </span>
      </div>

      <div style={{ fontSize: "13px", color: "#374151" }}>
        Submitted by <strong>{item.author.name}</strong>
        {item.author.verification_level > 0 && (
          <span style={{ marginLeft: "6px", fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>
            ✓ L{item.author.verification_level}
          </span>
        )}
      </div>

      <label style={{ fontSize: "13px" }}>
        Reviewer remarks
        <textarea
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          rows={2}
          style={{ marginTop: "4px", resize: "vertical", fontSize: "13px" }}
        />
      </label>

      <div className="row" style={{ gap: "8px" }}>
        <button
          onClick={() => onAct("verify")}
          disabled={acting || !remarks.trim()}
          type="button"
          style={{ fontSize: "13px" }}
        >
          ✓ Verify
        </button>
        <button
          className="ghost"
          onClick={() => onAct("request-info")}
          disabled={acting || !remarks.trim()}
          type="button"
          style={{ fontSize: "13px" }}
        >
          ? Request info
        </button>
        <button
          className="danger"
          onClick={() => onAct("reject")}
          disabled={acting || !remarks.trim()}
          type="button"
          style={{ fontSize: "13px" }}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}

export default function VerificationAdminPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);

  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadQueue() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getVerificationQueue(token, 1, 30);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function getRemarks(postId: string) {
    return remarks[postId] ?? "";
  }

  async function act(postId: string, action: "verify" | "request-info" | "reject") {
    if (!token) return;
    const note = getRemarks(postId);
    if (!note.trim()) return;

    setActingOn(postId);
    setError(null);
    setSuccess(null);

    try {
      if (action === "verify") {
        await verifyPost(token, postId, note);
        setSuccess(`Post verified.`);
      } else if (action === "request-info") {
        await requestInfo(token, postId, note);
        setSuccess(`Info requested from author.`);
      } else {
        await rejectPost(token, postId, note);
        setSuccess(`Post rejected.`);
      }
      await loadQueue();
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
            <h1 style={{ margin: 0 }}>Verification queue</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
              Review submitted posts before they go live
            </p>
          </div>
          <div className="row" style={{ gap: "8px" }}>
            {items.length > 0 && (
              <span style={{ fontSize: "13px", color: "#d97706", fontWeight: 700 }}>
                {items.length} pending
              </span>
            )}
            <button className="ghost" onClick={() => void loadQueue()} type="button" style={{ fontSize: "13px" }}>
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

      {loading ? (
        <section className="card"><p className="muted">Loading queue…</p></section>
      ) : items.length === 0 ? (
        <section className="card stack" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p style={{ fontSize: "32px", margin: 0 }}>✅</p>
          <p style={{ fontWeight: 600, margin: "8px 0 4px" }}>Queue is empty</p>
          <p className="muted" style={{ fontSize: "13px", margin: 0 }}>No posts awaiting verification.</p>
        </section>
      ) : (
        <div className="stack" style={{ gap: "12px" }}>
          {items.map((item) => (
            <QueueCard
              key={item.post_id}
              item={item}
              remarks={getRemarks(item.post_id)}
              onRemarksChange={(val) => setRemarks((prev) => ({ ...prev, [item.post_id]: val }))}
              onAct={(action) => void act(item.post_id, action)}
              acting={actingOn === item.post_id}
            />
          ))}
        </div>
      )}
    </main>
  );
}
