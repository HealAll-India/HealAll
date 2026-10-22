import Link from "next/link";
import { CircleAlert, Search } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";

import { RequestCard } from "./request-card";
import type { FeedState } from "./use-feed";

type Props = Pick<
  FeedState,
  "items" | "hasNext" | "loading" | "loadingMore" | "error" | "filtered" | "loadMore" | "retry" | "clearFilters"
> & { viewerId?: string };

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="notice notice--error feed-error" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <p className="feed-error__text">{message}</p>
      <button type="button" className="ghost btn-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/** The request list with its loading, empty, error and "Show more" states. */
export function FeedResults({
  items,
  hasNext,
  loading,
  loadingMore,
  error,
  filtered,
  loadMore,
  retry,
  clearFilters,
  viewerId,
}: Props) {
  if (items === null) {
    if (error) return <ErrorNotice message={error.message} onRetry={retry} />;
    return <ListSkeleton count={3} label="Loading requests" />;
  }

  if (items.length === 0 && !loading) {
    return filtered ? (
      <EmptyState
        Icon={Search}
        title="No requests match these filters"
        action={
          <>
            <button type="button" className="secondary" onClick={clearFilters}>
              Clear filters
            </button>
            <Link href="/posts/new" className="btn-primary">
              Ask for help
            </Link>
          </>
        }
      >
        Try another city or category, or ask the community yourself.
      </EmptyState>
    ) : (
      <EmptyState
        Icon={Search}
        title="No open requests right now"
        action={
          <Link href="/posts/new" className="btn-primary">
            Ask for help
          </Link>
        }
      >
        When members ask for help, their requests show up here.
      </EmptyState>
    );
  }

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? "Updating requests…" : ""}
      </span>
      <ul className="feed-list" aria-busy={loading}>
        {items.map((post) => (
          <li key={post.id}>
            <RequestCard post={post} viewerId={viewerId} />
          </li>
        ))}
      </ul>

      {error?.more ? <ErrorNotice message={error.message} onRetry={retry} /> : null}

      {hasNext && !loading && !error ? (
        <button
          type="button"
          className="ghost feed-more"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          aria-busy={loadingMore}
        >
          {loadingMore ? "Loading more…" : "Show more requests"}
        </button>
      ) : null}
    </>
  );
}
