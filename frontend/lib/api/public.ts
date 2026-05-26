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
  const safe = encodeURIComponent(postId);
  return publicGet<PublicPostDetail>(`/v1/public/posts/${safe}`);
}

/**
 * Fetch variant used by `generateMetadata` that distinguishes a confirmed
 * "not public" (404) from a transient backend failure. Without this the
 * metadata path would emit `noindex` on a network blip, telling crawlers
 * to deindex perfectly valid public posts.
 *
 * `status` is the backend HTTP status, or null when the fetch itself
 * threw (DNS / TCP / TLS / abort). Treat null as transient.
 */
export async function getPublicPostForMeta(
  postId: string
): Promise<{ post: PublicPostDetail | null; status: number | null }> {
  const safe = encodeURIComponent(postId);
  const url = `${PUBLIC_API_BASE}/v1/public/posts/${safe}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 }
    });
    if (!res.ok) {
      return { post: null, status: res.status };
    }
    return { post: (await res.json()) as PublicPostDetail, status: res.status };
  } catch {
    return { post: null, status: null };
  }
}

export function listPublicComments(postId: string) {
  const safe = encodeURIComponent(postId);
  return publicGet<PublicCommentResponse[]>(`/v1/public/posts/${safe}/comments`);
}
