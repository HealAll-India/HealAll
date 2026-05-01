"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { getAdminStats } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { AdminStatsResponse } from "@/lib/types/api";

interface StatCardProps {
  label: string;
  value: number;
  accent?: string;
  href?: string;
}

function StatCard({ label, value, accent = "#16a34a", href }: StatCardProps) {
  const content = (
    <div
      className="card"
      style={{
        padding: "20px 24px",
        borderTop: `3px solid ${accent}`,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <span style={{ fontSize: "32px", fontWeight: 800, color: accent, lineHeight: 1 }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>{label}</span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }}>
        {content}
      </Link>
    );
  }
  return content;
}

export default function AdminDashboardPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.roles?.some((r) => r === "admin" || r === "head_admin") ?? false;

  useEffect(() => {
    if (!token || !isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getAdminStats(token)
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  return (
    <main className="page">
      <section className="card stack" style={{ marginBottom: "24px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>Platform overview — live data</p>
          </div>
          <div className="row" style={{ gap: "8px" }}>
            <Link href="/admin/verification" className="ghost" style={{ padding: "8px 14px", fontSize: "13px" }}>
              Verification queue →
            </Link>
            <Link href="/admin/moderation" className="ghost" style={{ padding: "8px 14px", fontSize: "13px" }}>
              Moderation →
            </Link>
          </div>
        </div>
      </section>

      {!isAdmin ? (
        <section className="card">
          <p className="error">Admin access required.</p>
        </section>
      ) : loading ? (
        <section className="card">
          <p className="muted">Loading stats…</p>
        </section>
      ) : error ? (
        <section className="card">
          <p className="error">{error}</p>
        </section>
      ) : stats ? (
        <>
          {/* Users row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <StatCard label="Total users" value={stats.total_users} accent="#2563eb" />
            <StatCard label="Verified users" value={stats.verified_users} accent="#16a34a" />
            <StatCard label="Suspended users" value={stats.suspended_users} accent="#dc2626" href="/admin/moderation" />
          </div>

          {/* Activity row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <StatCard label="Active posts" value={stats.active_posts} accent="#16a34a" href="/feed" />
            <StatCard label="Open cases" value={stats.open_cases} accent="#2563eb" />
            <StatCard label="Pending verifications" value={stats.pending_verifications} accent="#d97706" href="/admin/verification" />
            <StatCard label="Pending reports" value={stats.pending_reports} accent="#dc2626" href="/admin/moderation" />
          </div>

          {/* Quick links */}
          <section className="card stack">
            <h3 style={{ margin: 0 }}>Quick actions</h3>
            <div className="row" style={{ gap: "10px", flexWrap: "wrap" }}>
              <Link href="/admin/verification" style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>
                Review verification queue ({stats.pending_verifications})
              </Link>
              <span style={{ color: "#e5e7eb" }}>·</span>
              <Link href="/admin/moderation" style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>
                Review open reports ({stats.pending_reports})
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
