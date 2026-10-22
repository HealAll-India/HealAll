import Link from "next/link";
import { ChevronRight, ClipboardCheck, Clock, ShieldCheck } from "lucide-react";

import { formatCount, plural } from "@/lib/format";
import type { PostSummary } from "@/lib/types/api";
import type { LandingStatsResponse } from "@/lib/types/public";

import { VoteText } from "./feed-notices";

interface Props {
  pending: readonly PostSummary[];
  voteCount: number | null;
  /** The vote queue failed to load; don't claim the member is caught up. */
  queueUnavailable: boolean;
  stats: LandingStatsResponse | null;
  openTotal: number | null;
}

/** Desktop (≥ 1024px) right rail: what needs you, community numbers, safety tips. */
export function FeedSidebar({ pending, voteCount, queueUnavailable, stats, openTotal }: Props) {
  return (
    <aside className="feed-aside" aria-label="For you">
      <WaitingCard pending={pending} voteCount={voteCount} queueUnavailable={queueUnavailable} />
      <CommunityCard stats={stats} openTotal={openTotal} />
      <SafetyCard />
    </aside>
  );
}

function WaitingCard({
  pending,
  voteCount,
  queueUnavailable,
}: Pick<Props, "pending" | "voteCount" | "queueUnavailable">) {
  const votes = voteCount ?? 0;
  const empty = !queueUnavailable && votes === 0 && pending.length === 0;
  return (
    <section className="feed-side-card">
      <h2 className="feed-side-card__title">Waiting on you</h2>
      {empty ? (
        <p className="feed-side-card__muted">You&apos;re all caught up.</p>
      ) : (
        <ul className="feed-waiting-list">
          {queueUnavailable ? (
            <li>
              <Link href="/verify" className="feed-waiting-item">
                <span className="feed-waiting-icon" aria-hidden="true">
                  <ClipboardCheck size={18} />
                </span>
                <span className="feed-waiting-item__text">
                  Couldn&apos;t check requests waiting for your vote. <strong>Open Verify</strong>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ) : votes > 0 ? (
            <li>
              <Link href="/verify" className="feed-waiting-item">
                <span className="feed-waiting-icon" aria-hidden="true">
                  <ClipboardCheck size={18} />
                </span>
                <span className="feed-waiting-item__text">
                  <VoteText count={votes} />
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ) : null}
          {pending.length > 0 ? (
            <li>
              <Link href={`/posts/${pending[0].id}`} className="feed-waiting-item">
                <span className="feed-waiting-icon feed-waiting-icon--warning" aria-hidden="true">
                  <Clock size={18} />
                </span>
                <span className="feed-waiting-item__text">
                  {pending.length === 1 ? (
                    <>
                      Your request is <strong>awaiting approval</strong>
                    </>
                  ) : (
                    <>
                      <strong>{plural(pending.length, "request")}</strong> of yours are awaiting approval
                    </>
                  )}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function CommunityCard({ stats, openTotal }: Pick<Props, "stats" | "openTotal">) {
  if (!stats) return null;
  const figures = [
    ...(openTotal === null ? [] : [{ label: "open requests", value: openTotal }]),
    { label: "cities", value: stats.cities },
    { label: "verified members", value: stats.verified_members },
  ];
  return (
    <section className="feed-side-card">
      <h2 className="feed-side-card__title">Community</h2>
      <dl className="feed-stats">
        {figures.map((f) => (
          <div key={f.label} className="feed-stats__item">
            <dt className="feed-stats__label">{f.label}</dt>
            <dd className="feed-stats__value">{formatCount(f.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SafetyCard() {
  return (
    <section className="feed-side-card feed-side-card--tips">
      <h2 className="feed-side-card__title">
        <ShieldCheck size={18} className="feed-side-card__title-icon" aria-hidden="true" />
        Helping safely
      </h2>
      <ul className="feed-tips">
        <li>Meet in public places — hospitals, stations, offices.</li>
        <li>Never share an OTP or send money before verifying.</li>
        <li>Report anything that feels off. We act fast.</li>
      </ul>
      <Link href="/#community-guidelines" className="feed-side-card__link">
        Community guidelines
      </Link>
    </section>
  );
}
