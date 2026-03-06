"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { getFeed } from "@/lib/api/posts";
import { ApiError } from "@/lib/api/client";
import { postCategories, postUrgencies } from "@/lib/constants";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { FeedResponse } from "@/lib/types/api";
import { AuthRequired } from "@/components/ui/auth-required";

interface FeedFilters {
  city: string;
  category: string;
  urgency: string;
  search: string;
}

const initialFilters: FeedFilters = {
  city: "",
  category: "",
  urgency: "",
  search: ""
};

export default function FeedPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FeedResponse | null>(null);
  const [filters, setFilters] = useState(initialFilters);

  async function loadFeed(appliedFilters = filters) {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getFeed(token, {
        page: 1,
        per_page: 20,
        city: appliedFilters.city,
        category: appliedFilters.category,
        urgency: appliedFilters.urgency,
        search: appliedFilters.search
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  function onApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadFeed(filters);
  }

  useEffect(() => {
    if (token) {
      void loadFeed(initialFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="page">
      <section className="card stack">
        <h1>Feed (Module 3)</h1>
        <p className="muted">Verified help requests with search and filters.</p>
      </section>

      {!hydrated ? null : token ? (
        <>
          <section className="card">
            <form className="grid" onSubmit={onApply}>
              <div className="row">
                <label style={{ flex: 1 }}>
                  Search
                  <input
                    value={filters.search}
                    onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                    placeholder="Keyword"
                  />
                </label>
                <label style={{ flex: 1 }}>
                  City
                  <input
                    value={filters.city}
                    onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
                    placeholder="City"
                  />
                </label>
              </div>

              <div className="row">
                <label style={{ flex: 1 }}>
                  Category
                  <select
                    value={filters.category}
                    onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                  >
                    <option value="">All</option>
                    {postCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  Urgency
                  <select
                    value={filters.urgency}
                    onChange={(event) => setFilters((prev) => ({ ...prev, urgency: event.target.value }))}
                  >
                    <option value="">All</option>
                    {postUrgencies.map((urgency) => (
                      <option key={urgency} value={urgency}>
                        {urgency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="row">
                <button disabled={loading} type="submit">
                  {loading ? "Loading..." : "Apply Filters"}
                </button>
                <button
                  className="ghost"
                  disabled={loading}
                  onClick={() => {
                    setFilters(initialFilters);
                    void loadFeed(initialFilters);
                  }}
                  type="button"
                >
                  Reset
                </button>
                <Link href="/posts/new">
                  <button className="secondary" type="button">
                    Create Post
                  </button>
                </Link>
              </div>
            </form>
          </section>

          {error ? <p className="error">{error}</p> : null}

          <section className="grid">
            {result?.items.map((post) => (
              <article className="card stack" key={post.id}>
                <div className="row">
                  <h3 style={{ margin: 0 }}>{post.title}</h3>
                  <span className="badge">{post.category}</span>
                  <span className="badge warn">{post.urgency}</span>
                  <span className="badge">{post.status}</span>
                </div>
                <p>{post.description}</p>
                <p className="muted">
                  {post.city} · by {post.author.name} · level {post.author.verification_level}
                </p>
                <Link href={`/posts/${post.id}`}>
                  <button className="ghost" type="button">
                    View Post
                  </button>
                </Link>
              </article>
            ))}
            {!loading && result && result.items.length === 0 ? (
              <section className="card">
                <p className="muted">No posts found for current filters.</p>
              </section>
            ) : null}
          </section>
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
