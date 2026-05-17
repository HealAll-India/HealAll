"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { CategoryBubbles } from "@/components/feed/category-bubbles";
import { FeedCard }        from "@/components/feed/feed-card";
import { FeedSidebar }     from "@/components/feed/feed-sidebar";
import { getFeed, getMyPosts } from "@/lib/api/posts";
import { ApiError }        from "@/lib/api/client";
import { useHydrated }     from "@/lib/hooks/use-hydrated";
import { useAuthStore }    from "@/lib/stores/auth-store";
import type { FeedFilters, FeedResponse, PostSummary } from "@/lib/types/api";
import { AuthRequired }    from "@/components/ui/auth-required";

const INITIAL_FILTERS: FeedFilters = { city: "", category: "", urgency: "", search: "" };

export default function FeedPage() {
  const hydrated = useHydrated();
  const token    = useAuthStore(s => s.accessToken);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<FeedResponse | null>(null);
  const [filters, setFilters] = useState<FeedFilters>(INITIAL_FILTERS);
  const [pending, setPending] = useState<PostSummary[]>([]);

  async function loadFeed(f: FeedFilters = filters) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getFeed(token, { page: 1, per_page: 20, ...f });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  function applyFilter(partial: Partial<FeedFilters>) {
    const next = { ...filters, ...partial };
    setFilters(next);
    void loadFeed(next);
  }

  useEffect(() => {
    if (!token) return;
    void loadFeed(INITIAL_FILTERS);
    // Surface user's own pending posts so they don't think their submission
    // got swallowed when the feed only shows ACTIVE posts.
    void getMyPosts(token)
      .then((r) => {
        const pendingStatuses = new Set(["submitted", "needs_info", "draft"]);
        setPending(r.items.filter((p) => pendingStatuses.has(p.status)));
      })
      .catch(() => {
        // Drop stale state on failure — don't leave a misleading banner up.
        setPending([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!hydrated) return null;
  if (!token)    return <AuthRequired />;

  return (
    <main>
      <CategoryBubbles
        active={filters.category}
        onChange={cat => applyFilter({ category: cat })}
      />

      {pending.length > 0 && (
        <section className="card feed-pending-banner">
          <p className="feed-pending-banner__title">
            ⏳ You have {pending.length} post{pending.length === 1 ? "" : "s"} pending community verification.
          </p>
          <p className="muted feed-pending-banner__sub">
            Posts appear in the public feed once enough community members have approved.{" "}
            <Link href="/verify" className="feed-pending-banner__link">Help verify others →</Link>
          </p>
        </section>
      )}

      {error   ? <p className="error"  style={{ marginBottom: "12px" }}>{error}</p>    : null}
      {loading ? <p className="muted"  style={{ marginBottom: "12px" }}>Loading…</p>  : null}

      <div className="feed-layout">
        <div>
          {result?.items.map(post => (
            <FeedCard key={post.id} post={post} />
          ))}
          {!loading && result && result.items.length === 0 ? (
            <div className="card">
              <p className="muted">No posts match your filters.</p>
            </div>
          ) : null}
        </div>

        <FeedSidebar
          feedResult={result}
          filters={filters}
          onFilterChange={applyFilter}
        />
      </div>
    </main>
  );
}
