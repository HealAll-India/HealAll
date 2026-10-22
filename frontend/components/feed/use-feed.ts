"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { getFeed } from "@/lib/api/posts";
import type { FeedFilters, PostSummary } from "@/lib/types/api";

import { EMPTY_FILTERS, appendUnique, hasActiveFilters, toFeedQuery, unionCities } from "./feed-query";

export const SEARCH_DEBOUNCE_MS = 350;

export interface FeedError {
  message: string;
  /** True when "Show more" failed (the list above is still valid). */
  more: boolean;
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "We couldn't load requests. Check your connection and try again.";
}

/**
 * Feed state: filters (search debounced), first page + "Show more" pages,
 * the session-wide city list, and a request-sequence guard so a slow,
 * superseded response can never overwrite a newer one.
 *
 * Mount it per account (the page keys it by user) so nothing leaks across
 * an account switch.
 */
export function useFeed(token: string | null) {
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  /** `null` until the first page for the current filters has loaded. */
  const [items, setItems] = useState<PostSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<FeedError | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  /** Unfiltered open-request count, for the sidebar "Community" card. */
  const [openTotal, setOpenTotal] = useState<number | null>(null);
  const seq = useRef(0);

  const loadFirst = useCallback(
    async (f: FeedFilters) => {
      if (!token) return;
      const id = ++seq.current;
      setLoading(true);
      setLoadingMore(false);
      setError(null);
      try {
        const res = await getFeed(token, toFeedQuery(f, 1));
        if (id !== seq.current) return;
        setItems(res.items);
        setTotal(res.total);
        setPage(1);
        setHasNext(res.has_next);
        setCities((prev) => unionCities(prev, res.items.map((p) => p.city)));
        if (!hasActiveFilters(f)) setOpenTotal(res.total);
      } catch (err) {
        if (id !== seq.current) return;
        setItems(null);
        setError({ message: errorMessage(err), more: false });
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [token],
  );

  const loadMore = useCallback(async () => {
    if (!token || loading || loadingMore || !hasNext) return;
    const id = ++seq.current;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await getFeed(token, toFeedQuery(filters, page + 1));
      if (id !== seq.current) return;
      setItems((prev) => appendUnique(prev ?? [], res.items));
      setTotal(res.total);
      setPage(page + 1);
      setHasNext(res.has_next);
      setCities((prev) => unionCities(prev, res.items.map((p) => p.city)));
    } catch (err) {
      if (id !== seq.current) return;
      setError({ message: errorMessage(err), more: true });
    } finally {
      if (id === seq.current) setLoadingMore(false);
    }
  }, [token, loading, loadingMore, hasNext, filters, page]);

  // Any filter change (including the debounced search) reloads page 1.
  useEffect(() => {
    void loadFirst(filters);
  }, [filters, loadFirst]);

  // Debounce typing into the search filter.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search.trim() === searchInput.trim() ? f : { ...f, search: searchInput }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setFilter = useCallback((partial: Partial<Omit<FeedFilters, "search">>) => {
    setFilters((f) => {
      const next = { ...f, ...partial };
      return next.city === f.city && next.category === f.category && next.urgency === f.urgency ? f : next;
    });
  }, []);

  /** Apply the search box now (Enter), skipping the debounce. */
  const submitSearch = useCallback(() => {
    setFilters((f) => (f.search.trim() === searchInput.trim() ? f : { ...f, search: searchInput }));
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setFilters((f) => (hasActiveFilters(f) ? EMPTY_FILTERS : f));
  }, []);

  const retry = useCallback(() => {
    if (error?.more) void loadMore();
    else void loadFirst(filters);
  }, [error, loadMore, loadFirst, filters]);

  return {
    filters,
    searchInput,
    setSearchInput,
    submitSearch,
    setFilter,
    clearFilters,
    items,
    total,
    hasNext,
    loading,
    loadingMore,
    error,
    cities,
    openTotal,
    loadMore,
    retry,
    filtered: hasActiveFilters(filters),
  };
}

export type FeedState = ReturnType<typeof useFeed>;
