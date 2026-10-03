"use client";

import { useEffect, useState } from "react";

import { getCommunityQueue } from "@/lib/api/community-verification";

/** Pages that change the queue (e.g. after a vote) can dispatch this to refresh the badge. */
export const VERIFY_QUEUE_CHANGED = "healall:verify-queue-changed";

/**
 * How many requests are waiting for this member's community vote, for the
 * Verify badge. Only L1+ members can vote (the API 403s otherwise), so the
 * call is skipped below that. Refetched on navigation, window focus and
 * VERIFY_QUEUE_CHANGED; failures hide the badge.
 */
export function useVerifyCount(token: string | null, level: number, pathname: string): number | null {
  // The count is stored with the token it was fetched for, so after an
  // account switch the previous member's number is never shown.
  const [result, setResult] = useState<{ token: string; count: number | null } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("focus", bump);
    window.addEventListener(VERIFY_QUEUE_CHANGED, bump);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener(VERIFY_QUEUE_CHANGED, bump);
    };
  }, []);

  useEffect(() => {
    if (!token || level < 1) return;
    let active = true;
    getCommunityQueue(token, 1, 1)
      .then((res) => {
        if (active) setResult({ token, count: res.total });
      })
      .catch(() => {
        if (active) setResult({ token, count: null });
      });
    return () => {
      active = false;
    };
  }, [token, level, pathname, tick]);

  if (!token || level < 1 || result?.token !== token) return null;
  return result.count;
}
