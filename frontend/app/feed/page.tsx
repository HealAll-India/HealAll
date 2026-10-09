"use client";

import { FeedControls } from "@/components/feed/feed-controls";
import { PendingNotice, WaitingRow } from "@/components/feed/feed-notices";
import { FeedResults } from "@/components/feed/feed-results";
import { FeedSidebar } from "@/components/feed/feed-sidebar";
import { useFeed } from "@/components/feed/use-feed";
import { useWaiting } from "@/components/feed/use-waiting";
import { AuthRequired } from "@/components/ui/auth-required";
import { PageHeader } from "@/components/ui/page-header";
import { plural } from "@/lib/format";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function FeedPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  // Keyed by account: switching users remounts the feed, so no filters,
  // results or pending counts from the previous account can flash up.
  return (
    <MemberFeed
      key={user?.id ?? token}
      token={token}
      viewerId={user?.id}
      verificationLevel={user?.verification_level ?? 0}
    />
  );
}

interface MemberFeedProps {
  token: string;
  viewerId?: string;
  verificationLevel: number;
}

function MemberFeed({ token, viewerId, verificationLevel }: MemberFeedProps) {
  const feed = useFeed(token);
  const { pending, voteCount, stats } = useWaiting(token, verificationLevel);

  const subtitle = feed.items === null ? "Most urgent first" : `${plural(feed.total, "request")} · most urgent first`;

  return (
    <main className="feed-page">
      <div className="feed-columns">
        <div className="feed-main">
          <PageHeader title="Open requests" subtitle={subtitle} />
          <FeedControls
            filters={feed.filters}
            searchInput={feed.searchInput}
            cities={feed.cities}
            onSearchInput={feed.setSearchInput}
            onSearchSubmit={feed.submitSearch}
            onChange={feed.setFilter}
          />
          <PendingNotice pending={pending} />
          <WaitingRow voteCount={voteCount} />
          <FeedResults
            items={feed.items}
            hasNext={feed.hasNext}
            loading={feed.loading}
            loadingMore={feed.loadingMore}
            error={feed.error}
            filtered={feed.filtered}
            loadMore={feed.loadMore}
            retry={feed.retry}
            clearFilters={feed.clearFilters}
            viewerId={viewerId}
          />
        </div>
        <FeedSidebar pending={pending} voteCount={voteCount} stats={stats} openTotal={feed.openTotal} />
      </div>
    </main>
  );
}
