"use client";

import { useEffect, useState } from "react";

import { getCommunityQueue } from "@/lib/api/community-verification";

/**
 * How many requests are waiting for this member's community vote, for the
 * Verify badge. Only L1+ members can vote (the API 403s otherwise), so
 * skip the call below that. Refetched on navigation; failures hide the badge.
 */
export function useVerifyCount(token: string | null, level: number, pathname: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  const enabled = Boolean(token) && level >= 1;

  useEffect(() => {
    if (!token || level < 1) return;
    let active = true;
    getCommunityQueue(token, 1, 1)
      .then((res) => {
        if (active) setCount(res.total);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, [token, level, pathname]);

  return enabled ? count : null;
}
