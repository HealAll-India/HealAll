import { getLandingStats } from "@/lib/api/public";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export async function LiveStats() {
  const stats = await getLandingStats();

  // Graceful empty state — never throw on the landing page.
  const helped = stats?.helped ?? 0;
  const verified = stats?.verified_members ?? 0;
  const cities = stats?.cities ?? 0;

  return (
    <div className="land__nums">
      <div className="land__num-card">
        <div className="land__num-val">{formatCount(helped)}</div>
        <div className="land__num-label">Lives helped</div>
      </div>
      <div className="land__num-card">
        <div className="land__num-val">{formatCount(verified)}</div>
        <div className="land__num-label">Verified members</div>
      </div>
      <div className="land__num-card">
        <div className="land__num-val">{formatCount(cities)}</div>
        <div className="land__num-label">Indian cities</div>
      </div>
    </div>
  );
}
