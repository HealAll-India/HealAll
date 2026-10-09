/**
 * Pure helpers for the member feed: filter → query mapping, the session-wide
 * city list and page merging. Kept free of React so they're easy to test.
 */
import type { FeedFilters, PostSummary } from "@/lib/types/api";

export const FEED_PAGE_SIZE = 20;

export const EMPTY_FILTERS: FeedFilters = { city: "", category: "", urgency: "", search: "" };

export interface FeedQuery {
  page: number;
  per_page: number;
  city?: string;
  category?: string;
  urgency?: string;
  search?: string;
}

/** Map UI filters to `GET /v1/feed` params, dropping blanks so they aren't sent. */
export function toFeedQuery(filters: FeedFilters, page = 1, perPage = FEED_PAGE_SIZE): FeedQuery {
  const query: FeedQuery = { page, per_page: perPage };
  const city = filters.city.trim();
  const search = filters.search.trim();
  if (city) query.city = city;
  if (filters.category) query.category = filters.category;
  if (filters.urgency) query.urgency = filters.urgency;
  if (search) query.search = search;
  return query;
}

/** True when any filter narrows the feed (whitespace-only search doesn't count). */
export function hasActiveFilters(filters: FeedFilters): boolean {
  return Boolean(filters.city.trim() || filters.category || filters.urgency || filters.search.trim());
}

/**
 * Sorted union of every city seen so far, the cities in a new response and
 * the currently selected one — so picking a city never hides the others.
 */
export function unionCities(
  known: readonly string[],
  incoming: readonly string[] = [],
  selected = "",
): string[] {
  const set = new Set<string>();
  for (const city of [...known, ...incoming, selected]) {
    const trimmed = city.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "en-IN"));
}

/** Append the next page, skipping posts already shown (pages can shift between requests). */
export function appendUnique(current: readonly PostSummary[], next: readonly PostSummary[]): PostSummary[] {
  const seen = new Set(current.map((p) => p.id));
  const merged = [...current];
  for (const post of next) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    merged.push(post);
  }
  return merged;
}
