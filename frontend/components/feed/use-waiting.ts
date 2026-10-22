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

/**
 * Things that need the member's attention, plus community stats for the
 * sidebar. Mounted per account (the page keys it by user), so state starts
 * empty after an account switch and never shows the previous user's counts.
 */
export function useWaiting(token: string | null, verificationLevel: number) {
  const [pending, setPending] = useState<PostSummary[]>([]);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  /** The vote queue failed to load, so "nothing to vote on" is unknown, not zero. */
  const [queueFailed, setQueueFailed] = useState(false);
  const [stats, setStats] = useState<LandingStatsResponse | null>(null);

  // The member's own requests that are still in community voting — so they
  // don't think a submission got swallowed when the feed only shows live posts.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMyPosts(token)
      .then((r) => {
        if (!cancelled) setPending(r.items.filter((p) => PENDING_STATUSES.has(p.status)));
      })
      .catch(() => {
        // Drop stale state on failure — don't leave a misleading banner up.
        if (!cancelled) setPending([]);
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
        setQueueFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setVoteCount(null);
        setQueueFailed(true);
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
  return {
    pending,
    voteCount: verified ? voteCount : null,
    queueUnavailable: verified && queueFailed,
    stats,
  };
}
