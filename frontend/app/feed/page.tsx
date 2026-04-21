"use client";

import { useEffect, useState } from "react";

import { CategoryBubbles } from "@/components/feed/category-bubbles";
import { FeedCard }        from "@/components/feed/feed-card";
import { FeedSidebar }     from "@/components/feed/feed-sidebar";
import { getFeed }         from "@/lib/api/posts";
import { ApiError }        from "@/lib/api/client";
import { useHydrated }     from "@/lib/hooks/use-hydrated";
import { useAuthStore }    from "@/lib/stores/auth-store";
import type { FeedFilters, FeedResponse } from "@/lib/types/api";
import { AuthRequired }    from "@/components/ui/auth-required";

const INITIAL_FILTERS: FeedFilters = { city: "", category: "", urgency: "", search: "" };

export default function FeedPage() {
  const hydrated = useHydrated();
  const token    = useAuthStore(s => s.accessToken);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<FeedResponse | null>(null);
  const [filters, setFilters] = useState<FeedFilters>(INITIAL_FILTERS);

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
    if (token) void loadFeed(INITIAL_FILTERS);
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
