import { getLandingStats } from "@/lib/api/public";

/**
 * getLandingStats already swallows fetch errors and returns null
 * (see `frontend/lib/api/public.ts`), but adding an extra try/catch
 * here is belt-and-suspenders: it protects the landing page render
 * if a future change to the API client decides to surface errors.
 */
async function getStatsSafe() {
  try {
    return await getLandingStats();
  } catch {
    return null;
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Bottom strip of the landing right-card. Replaces the old fake
 * "47 helped today · 184 helpers online · 19 cities active" string with
 * real counts pulled from /v1/public/stats. Empty state degrades to a
 * "growing" message so a brand-new install never looks broken.
 */
export async function LiveImpactStrip() {
  const stats = await getStatsSafe();

  if (!stats || (stats.helped === 0 && stats.verified_members === 0 && stats.cities === 0)) {
    return (
      <div className="impact-strip">
        <span className="impact-strip__dot" />
        Community growing — be the first to lend a hand.
      </div>
    );
  }

  return (
    <div className="impact-strip">
      <span className="impact-strip__dot" />
      {formatCount(stats.helped)} lives helped ·{" "}
      {formatCount(stats.verified_members)} verified members ·{" "}
      {formatCount(stats.cities)} cities
    </div>
  );
}

/**
 * Small in-head live indicator that previously read "184 online".
 * Repurposed to show "{verified_members} members" — the closest honest
 * proxy for "who can help right now" without a real presence system.
 */
export async function LiveFeedHeadCount() {
  const stats = await getStatsSafe();
  const verified = stats?.verified_members ?? 0;
  return (
    <span className="land__feed-sub">
      <span className="impact-strip__dot impact-strip__dot--inline" />
      {formatCount(verified)} members
    </span>
  );
}
