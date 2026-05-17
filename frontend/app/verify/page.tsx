"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { MapPicker } from "@/components/ui/map-picker";
import { ApiError } from "@/lib/api/client";
import {
  CommunityVoteItem,
  VoteDecision,
  castCommunityVote,
  getCommunityQueue,
} from "@/lib/api/community-verification";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";

const DECISION_LABEL: Record<VoteDecision, { label: string; emoji: string; tone: string }> = {
  approve: { label: "Approve", emoji: "✅", tone: "#16a34a" },
  needs_info: { label: "Needs info", emoji: "❓", tone: "#d97706" },
  reject: { label: "Reject", emoji: "🚫", tone: "#e11d48" },
};

export default function CommunityVerifyPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const sessionUser = useAuthStore((s) => s.user);

  const [items, setItems] = useState<CommunityVoteItem[]>([]);
  const [threshold, setThreshold] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  const voterLevel = sessionUser?.verification_level ?? 0;

  const loadQueue = useCallback(async () => {
    // Backend rejects sub-L1 voters with 403. Don't fire a guaranteed-401/403
    // request just to surface the same gate the UI already shows.
    if (!token || voterLevel < 1) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCommunityQueue(token);
      setItems(data.items);
      setThreshold(data.threshold);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load community queue");
    } finally {
      setLoading(false);
    }
  }, [token, voterLevel]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function handleVote(item: CommunityVoteItem, decision: VoteDecision) {
    if (!token) return;
    setBusyPost(item.post_id);
    setError(null);
    setFlash(null);
    try {
      const result = await castCommunityVote(token, item.post_id, decision, reasons[item.post_id]);
      if (result.promoted_to_active) {
        setFlash(`✨ Post "${item.title}" is now ACTIVE — thanks for verifying!`);
      } else {
        setFlash(
          `Vote recorded: ${decision} (${result.votes.approve}/${result.votes.threshold} approvals).`,
        );
      }
      // Remove the post the user just voted on from the local list.
      setItems((prev) => prev.filter((i) => i.post_id !== item.post_id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Vote failed");
    } finally {
      setBusyPost(null);
    }
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  const canVote = voterLevel >= 1;

  return (
    <main className="page">
      <section className="card stack">
        <h1 className="verify-title">Community Verification</h1>
        <p className="muted verify-subtitle">
          Help your neighbours by reviewing new help requests. {threshold} approvals
          from verified members promote a post to the active feed.
        </p>
        {!canVote && (
          <p className="error verify-subtitle">
            You need verification level 1+ to vote.{" "}
            <Link href="/profile" className="feed-pending-banner__link">
              Verify your profile
            </Link>{" "}
            to participate.
          </p>
        )}
      </section>

      {flash && <p className="success" role="status" aria-live="polite">{flash}</p>}
      {error && <p className="error" role="alert" aria-live="assertive">{error}</p>}

      {loading && items.length === 0 && (
        <section className="card"><p className="muted">Loading…</p></section>
      )}

      {!loading && !error && items.length === 0 && (
        <section className="card stack">
          <p className="muted post-loc-meta">
            No posts pending community review right now. Check back soon!
          </p>
        </section>
      )}

      {items.map((item) => {
        const hasMap = item.latitude != null && item.longitude != null;
        const approveCount = item.votes.approve;
        return (
          <section key={item.post_id} className="card stack verify-item">
            <div className="row verify-item__header">
              <div style={{ flex: 1 }}>
                <h2 className="verify-title" style={{ fontSize: "17px" }}>{item.title}</h2>
                <p className="muted verify-item__meta">
                  {item.author.name} · L{item.author.verification_level} · {item.category.replace(/_/g, " ")} · {item.urgency}
                </p>
              </div>
              <span className="badge">
                {approveCount}/{item.votes.threshold} approvals
              </span>
            </div>

            <p className="verify-item__body">
              {item.description}
            </p>

            <div className="verify-item__loc">
              📍 {item.address ?? "—"}
              {item.pincode ? ` · ${item.pincode}` : ""}
              {" · "}{item.city}
            </div>

            {hasMap && (
              <MapPicker
                latitude={item.latitude ?? null}
                longitude={item.longitude ?? null}
                onChange={() => { /* read-only */ }}
                readOnly
                height={200}
              />
            )}

            <label className="verify-note-label">
              Optional note for the author
              <input
                value={reasons[item.post_id] ?? ""}
                onChange={(e) => setReasons((r) => ({ ...r, [item.post_id]: e.target.value }))}
                placeholder="e.g. Please add a contact number"
                maxLength={500}
              />
            </label>

            <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
              {(Object.keys(DECISION_LABEL) as VoteDecision[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!canVote || busyPost === item.post_id}
                  onClick={() => handleVote(item, d)}
                  style={{
                    background: d === "approve" ? "var(--gradient-brand)" : undefined,
                    borderColor: DECISION_LABEL[d].tone,
                    color: d === "approve" ? "#fff" : DECISION_LABEL[d].tone,
                    boxShadow: d === "approve" ? "var(--shadow-btn)" : "inset 0 0 0 1px " + DECISION_LABEL[d].tone,
                  }}
                  className={d === "approve" ? undefined : "ghost"}
                >
                  {busyPost === item.post_id ? "…" : `${DECISION_LABEL[d].emoji} ${DECISION_LABEL[d].label}`}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
