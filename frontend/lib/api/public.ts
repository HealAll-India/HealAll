/**
 * Unauthenticated reads for the landing page.
 *
 * Uses raw `fetch` rather than `lib/api/client.ts` because:
 *   - the shared apiClient sends `credentials: "include"` (cookies); these
 *     endpoints are auth-free and including cookies trips CORS.
 *   - apiClient maps 401 to `auth:expired`; a transient hiccup on the
 *     public path must not log a real user out.
 *   - we want Next's `{ next: { revalidate } }` cache hints so the server
 *     component can de-dupe between requests within the 30-second window.
 */

import type {
  LandingStatsResponse,
  PublicCommentResponse,
  PublicFeedResponse,
  PublicPostDetail
} from "@/lib/types/public";

const PUBLIC_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const REVALIDATE_SECONDS = 30;

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS }
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Backend down / network blip → render graceful empty state, never crash
    // the landing page.
    return null;
  }
}

export function getLandingStats() {
  return publicGet<LandingStatsResponse>("/v1/public/stats");
}

export function getPublicFeed(params: {
  page?: number;
  per_page?: number;
  city?: string;
  category?: string;
  urgency?: string;
} = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const suffix = qs.toString();
  return publicGet<PublicFeedResponse>(
    `/v1/public/posts${suffix ? `?${suffix}` : ""}`
  );
}

export function getPublicPost(postId: string) {
  return publicGet<PublicPostDetail>(`/v1/public/posts/${postId}`);
}

export function listPublicComments(postId: string) {
  return publicGet<PublicCommentResponse[]>(`/v1/public/posts/${postId}/comments`);
}
