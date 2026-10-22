"use client";

import { useEffect, useState } from "react";

import { getCommunityQueue } from "@/lib/api/community-verification";
import { getMyPosts } from "@/lib/api/posts";
import { getLandingStats } from "@/lib/api/public";
import type { PostSummary } from "@/lib/types/api";
import type { LandingStatsResponse } from "@/lib/types/public";

/**
 * Drafts are author-private and not yet in community voting, so only these
 * count as "awaiting approval".
 */
const PENDING_STATUSES = new Set(["submitted", "needs_info"]);

/** Where each "waiting on you" source stands; only "ready" results are trustworthy. */
export type LoadStatus = "loading" | "ready" | "failed";

export interface WaitingStatus {
  /** The member's own requests still in community voting. */
  pending: LoadStatus;
  /** Requests awaiting this member's vote ("ready" for unverified members, who can't vote). */
  queue: LoadStatus;
}

/**
 * Things that need the member's attention, plus community stats for the
 * sidebar. Mounted per account (the page keys it by user), so state starts
 * empty after an account switch and never shows the previous user's counts.
 */
export function useWaiting(token: string | null, verificationLevel: number) {
  // Only promise callbacks update these (react-hooks/set-state-in-effect); the
  // page remounts this hook per account, so "loading" is the right start.
  const [pending, setPending] = useState<PostSummary[]>([]);
  const [pendingStatus, setPendingStatus] = useState<LoadStatus>("loading");
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [queueStatus, setQueueStatus] = useState<LoadStatus>("loading");
  const [stats, setStats] = useState<LandingStatsResponse | null>(null);

  // The member's own requests that are still in community voting — so they
  // don't think a submission got swallowed when the feed only shows live posts.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMyPosts(token)
      .then((r) => {
        if (cancelled) return;
        setPending(r.items.filter((p) => PENDING_STATUSES.has(p.status)));
        setPendingStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // Drop stale state on failure — don't leave a misleading banner up.
        setPending([]);
        setPendingStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Requests awaiting this member's vote (verified members only).
  useEffect(() => {
    if (!token || verificationLevel < 1) return;
    let cancelled = false;
    getCommunityQueue(token, 1, 1)
      .then((r) => {
        if (cancelled) return;
        setVoteCount(r.total);
        setQueueStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setVoteCount(null);
        setQueueStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token, verificationLevel]);

  useEffect(() => {
    let cancelled = false;
    getLandingStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        // Community card simply stays hidden when stats are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const verified = verificationLevel >= 1;
  const status: WaitingStatus = { pending: pendingStatus, queue: verified ? queueStatus : "ready" };
  return { pending, voteCount: verified ? voteCount : null, status, stats };
}
