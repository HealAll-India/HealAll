import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api/posts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/posts")>()),
  getFeed: vi.fn(),
  getMyPosts: vi.fn(),
}));
vi.mock("@/lib/api/community-verification", () => ({ getCommunityQueue: vi.fn() }));
vi.mock("@/lib/api/public", () => ({ getLandingStats: vi.fn(() => new Promise(() => {})) }));

import { FeedControls } from "@/components/feed/feed-controls";
import { FeedSidebar } from "@/components/feed/feed-sidebar";
import { EMPTY_FILTERS, appendUnique, hasActiveFilters, toFeedQuery, unionCities } from "@/components/feed/feed-query";
import { RequestCard } from "@/components/feed/request-card";
import { useFeed } from "@/components/feed/use-feed";
import { useWaiting } from "@/components/feed/use-waiting";
import { shareLink, shareMessage } from "@/components/ui/share";
import { getCommunityQueue } from "@/lib/api/community-verification";
import { getFeed, getMyPosts } from "@/lib/api/posts";
import type { FeedResponse, PostSummary } from "@/lib/types/api";

function post(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id: "p1",
    title: "Need O- blood tonight",
    description: "Surgery at 8 PM, the blood bank is short.",
    category: "urgent",
    urgency: "critical",
    city: "Bengaluru",
    status: "active",
    author: { id: "u1", name: "Aisha Khan", verification_level: 1 },
    created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    ...overrides,
  };
}

describe("unionCities", () => {
  it("returns a sorted, de-duplicated union without blanks", () => {
    expect(unionCities(["Pune", "Chennai"], ["Bengaluru", "Pune", "  ", ""])).toEqual(["Bengaluru", "Chennai", "Pune"]);
  });

  it("keeps every known city after a city-filtered response", () => {
    const afterFirstLoad = unionCities([], ["Jaipur", "Chennai", "Bengaluru"]);
    // Filtering to Chennai only returns Chennai posts — the others must stay.
    const afterFilter = unionCities(afterFirstLoad, ["Chennai"], "Chennai");
    expect(afterFilter).toEqual(["Bengaluru", "Chennai", "Jaipur"]);
  });

  it("includes the selected city even if no response contained it", () => {
    expect(unionCities(["Pune"], [], "Agra")).toEqual(["Agra", "Pune"]);
  });
});

describe("toFeedQuery", () => {
  it("sends only the filters that are set, trimmed", () => {
    expect(toFeedQuery(EMPTY_FILTERS)).toEqual({ page: 1, per_page: 20 });
    expect(
      toFeedQuery({ city: " Pune ", category: "mentorship", urgency: "high", search: "  gate prep " }, 3),
    ).toEqual({ page: 3, per_page: 20, city: "Pune", category: "mentorship", urgency: "high", search: "gate prep" });
  });

  it("treats a whitespace-only search as no filter", () => {
    expect(toFeedQuery({ ...EMPTY_FILTERS, search: "   " })).toEqual({ page: 1, per_page: 20 });
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: "   " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, urgency: "critical" })).toBe(true);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function feedPage(ids: string[]): FeedResponse {
  return { items: ids.map((id) => post({ id })), page: 1, per_page: 20, total: ids.length, has_next: false };
}

describe("useFeed", () => {
  it("never lets a slower, superseded response overwrite a newer one", async () => {
    const initial = deferred<FeedResponse>();
    const filtered = deferred<FeedResponse>();
    vi.mocked(getFeed).mockReturnValueOnce(initial.promise).mockReturnValueOnce(filtered.promise);

    const { result } = renderHook(() => useFeed("token"));
    act(() => result.current.setFilter({ urgency: "critical" }));
    expect(getFeed).toHaveBeenCalledTimes(2);

    await act(async () => filtered.resolve(feedPage(["new"])));
    await act(async () => initial.resolve(feedPage(["old"])));

    expect(result.current.items?.map((p) => p.id)).toEqual(["new"]);
    expect(result.current.loading).toBe(false);
  });
});

describe("useWaiting", () => {
  it("reports each source as loading until it settles, then ready or failed", async () => {
    const posts = deferred<Awaited<ReturnType<typeof getMyPosts>>>();
    const queue = deferred<Awaited<ReturnType<typeof getCommunityQueue>>>();
    vi.mocked(getMyPosts).mockReturnValueOnce(posts.promise);
    vi.mocked(getCommunityQueue).mockReturnValueOnce(queue.promise);

    const { result } = renderHook(() => useWaiting("token", 1));
    expect(result.current.status).toEqual({ pending: "loading", queue: "loading" });

    await act(async () => queue.resolve({ total: 0 } as Awaited<ReturnType<typeof getCommunityQueue>>));
    expect(result.current.status).toEqual({ pending: "loading", queue: "ready" });
    expect(result.current.voteCount).toBe(0);

    await act(async () => posts.reject(new Error("offline")));
    expect(result.current.status).toEqual({ pending: "failed", queue: "ready" });
  });

  it("treats the vote queue as settled for members who can't vote", () => {
    vi.mocked(getCommunityQueue).mockClear();
    vi.mocked(getMyPosts).mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useWaiting("token", 0));
    expect(result.current.status.queue).toBe("ready");
    expect(result.current.voteCount).toBeNull();
    expect(getCommunityQueue).not.toHaveBeenCalled();
  });
});

describe("FeedSidebar", () => {
  const props = { pending: [], voteCount: null, stats: null, openTotal: null };
  const ready = { pending: "ready", queue: "ready" } as const;

  it("says caught up only once both sources loaded empty", () => {
    const { rerender } = render(<FeedSidebar {...props} status={{ pending: "loading", queue: "ready" }} />);
    expect(screen.getByRole("status").textContent).toBe("Checking what needs you…");

    rerender(<FeedSidebar {...props} voteCount={0} status={{ pending: "ready", queue: "loading" }} />);
    expect(screen.queryByText(/all caught up/)).toBeNull();

    rerender(<FeedSidebar {...props} voteCount={0} status={ready} />);
    expect(screen.getByRole("status").textContent).toBe("You're all caught up.");
  });

  it("never reports a failed load as caught up", () => {
    const { rerender } = render(<FeedSidebar {...props} status={{ pending: "ready", queue: "failed" }} />);
    expect(screen.queryByText(/all caught up/)).toBeNull();
    expect(screen.getByRole("link", { name: /Couldn.t check requests waiting for your vote/ }).getAttribute("href")).toBe(
      "/verify",
    );

    rerender(<FeedSidebar {...props} voteCount={0} status={{ pending: "failed", queue: "ready" }} />);
    expect(screen.getByRole("status").textContent).toBe("Couldn't check your requests right now.");
  });
});

describe("appendUnique", () => {
  it("appends the next page without repeating posts", () => {
    const merged = appendUnique([post({ id: "a" }), post({ id: "b" })], [post({ id: "b" }), post({ id: "c" })]);
    expect(merged.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("FeedControls", () => {
  it("offers every known city plus the selected one", () => {
    render(
      <FeedControls
        filters={{ ...EMPTY_FILTERS, city: "Agra" }}
        searchInput=""
        cities={["Pune", "Chennai"]}
        onSearchInput={() => {}}
        onSearchSubmit={() => {}}
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText("City");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["All cities", "Agra", "Chennai", "Pune"]);
  });

  it("marks the active category chip as pressed", () => {
    const onChange = vi.fn();
    render(
      <FeedControls
        filters={{ ...EMPTY_FILTERS, category: "skill_sharing" }}
        searchInput=""
        cities={[]}
        onSearchInput={() => {}}
        onSearchSubmit={() => {}}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Skills" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Mentorship" }));
    expect(onChange).toHaveBeenCalledWith({ category: "mentorship" });
  });
});

describe("RequestCard", () => {
  it("shows human labels and links to the post and its help section", () => {
    render(<RequestCard post={post({ category: "skill_sharing", urgency: "high" })} />);
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Skills")).toBeTruthy();
    expect(screen.queryByText("skill_sharing")).toBeNull();
    expect(screen.getByRole("link", { name: "Need O- blood tonight" }).getAttribute("href")).toBe("/posts/p1");
    expect(screen.getByRole("link", { name: "I can help" }).getAttribute("href")).toBe("/posts/p1#help");
    expect(screen.getByText("2h ago")).toBeTruthy();
  });

  it("hides the urgency badge for normal and low urgency", () => {
    const { container, rerender } = render(<RequestCard post={post({ urgency: "normal" })} />);
    expect(container.querySelector(".urgency-badge")).toBeNull();
    expect(screen.queryByText("Normal")).toBeNull();
    rerender(<RequestCard post={post({ urgency: "low" })} />);
    expect(container.querySelector(".urgency-badge")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
  });

  it("offers 'View' instead of 'I can help' on the member's own request", () => {
    const { rerender } = render(<RequestCard post={post()} viewerId="u1" />);
    expect(screen.queryByRole("link", { name: "I can help" })).toBeNull();
    expect(screen.getByRole("link", { name: /view your request/i }).getAttribute("href")).toBe("/posts/p1");
    rerender(<RequestCard post={post()} viewerId="someone-else" />);
    expect(screen.getByRole("link", { name: "I can help" })).toBeTruthy();
  });
});

describe("shareLink", () => {
  const data = { url: "https://healallindia.com/posts/p1", title: "Need blood" };

  it("uses the OS share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareLink(data, { share, clipboard: { writeText } as unknown as Clipboard })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Need blood", url: data.url });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink(data, { clipboard: { writeText } as unknown as Clipboard })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
    expect(shareMessage("copied")).toBe("Link copied");
  });

  it("ignores a dismissed share sheet (AbortError)", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    const writeText = vi.fn();
    expect(await shareLink(data, { share, clipboard: { writeText } as unknown as Clipboard })).toBe("dismissed");
    expect(writeText).not.toHaveBeenCalled();
    expect(shareMessage("dismissed")).toBe("");
  });

  it("reports a clipboard failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    expect(await shareLink(data, { clipboard: { writeText } as unknown as Clipboard })).toBe("failed");
  });
});

describe("ShareButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("announces 'Link copied' politely after copying", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<RequestCard post={post()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share request" }));
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/p1`);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Link copied");
  });
});
