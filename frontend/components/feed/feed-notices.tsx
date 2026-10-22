import Link from "next/link";
import { ChevronRight, ClipboardCheck, Clock } from "lucide-react";

import { plural } from "@/lib/format";
import type { PostSummary } from "@/lib/types/api";

/** "3 requests need your vote" — shared by the mobile row and the sidebar. */
export function VoteText({ count }: { count: number }) {
  return (
    <>
      <strong>{plural(count, "request")}</strong> {count === 1 ? "needs" : "need"} your vote
    </>
  );
}

/** Below 1024px: the member's own requests still in community voting. */
export function PendingNotice({ pending, failed }: { pending: readonly PostSummary[]; failed: boolean }) {
  if (failed) {
    return (
      <div className="notice notice--warning feed-pending" role="status">
        <Clock size={18} aria-hidden="true" />
        <span className="feed-pending__text">Couldn&apos;t check whether your requests are awaiting approval.</span>
      </div>
    );
  }
  if (pending.length === 0) return null;
  return (
    <Link href={`/posts/${pending[0].id}`} className="notice notice--warning feed-pending">
      <Clock size={18} aria-hidden="true" />
      <span className="feed-pending__text">
        You have <strong>{plural(pending.length, "request")}</strong> awaiting community approval
      </span>
      <span className="feed-pending__cta">
        View
        <ChevronRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Below 1024px: compact "Waiting on you" row when there are requests to vote on. */
export function WaitingRow({ voteCount, failed }: { voteCount: number | null; failed: boolean }) {
  if (failed) {
    return (
      <Link href="/verify" className="feed-waiting-row">
        <span className="feed-waiting-icon" aria-hidden="true">
          <ClipboardCheck size={18} />
        </span>
        <span className="feed-waiting-row__text">
          <span className="feed-waiting-row__label">Waiting on you</span>
          <span>Couldn&apos;t check requests waiting for your vote. Open Verify</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    );
  }
  if (!voteCount) return null;
  return (
    <Link href="/verify" className="feed-waiting-row">
      <span className="feed-waiting-icon" aria-hidden="true">
        <ClipboardCheck size={18} />
      </span>
      <span className="feed-waiting-row__text">
        <span className="feed-waiting-row__label">Waiting on you</span>
        <span>
          <VoteText count={voteCount} />
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}
