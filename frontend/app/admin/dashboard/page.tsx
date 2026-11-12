"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Flag,
  FolderOpen,
  HandHeart,
  RefreshCw,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";

import { StaffOnly } from "@/components/admin/staff-only";
import { canOpenStaffPage } from "@/components/layout/nav-config";
import { AuthRequired } from "@/components/ui/auth-required";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminStats } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { AdminStatsResponse } from "@/lib/types/api";

const NO_ROLES: readonly string[] = [];

function exact(n: number): string {
  return n.toLocaleString("en-IN");
}

interface AttentionProps {
  href: string;
  Icon: LucideIcon;
  count: number;
  one: string;
  many: string;
  clear: string;
}

/** A queue that needs staff: loud when work is waiting, calm when it's clear. */
function AttentionTile({ href, Icon, count, one, many, clear }: AttentionProps) {
  const waiting = count > 0;
  return (
    <Link href={href} className={`attention-tile${waiting ? " attention-tile--waiting" : ""}`}>
      <span className="attention-tile__icon" aria-hidden="true">
        {waiting ? <Icon size={22} /> : <CircleCheck size={22} />}
      </span>
      <span className="attention-tile__text">
        {waiting ? (
          <>
            <span className="attention-tile__count">{exact(count)}</span>{" "}
            <span className="attention-tile__label">{count === 1 ? one : many}</span>
          </>
        ) : (
          <span className="attention-tile__label">{clear}</span>
        )}
      </span>
      <ChevronRight className="attention-tile__chevron" size={20} aria-hidden="true" />
    </Link>
  );
}

function StatTile({ Icon, label, value, hint }: { Icon: LucideIcon; label: string; value: number; hint?: string }) {
  return (
    <div className="stat-tile">
      <dt className="stat-tile__label">
        <Icon size={16} aria-hidden="true" />
        {label}
      </dt>
      <dd className="stat-tile__value">{exact(value)}</dd>
      {hint ? <dd className="stat-tile__hint">{hint}</dd> : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="admin-sections" role="status" aria-live="polite">
      <span className="sr-only">Loading the dashboard…</span>
      <div className="attention-grid" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="attention-tile attention-tile--skeleton">
            <Skeleton className="skeleton--avatar" />
            <span className="attention-tile__text">
              <Skeleton width="48px" />
              <Skeleton width="140px" />
            </span>
          </div>
        ))}
      </div>
      <div className="stat-grid" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat-tile">
            <Skeleton width="90px" />
            <Skeleton className="skeleton--title" width="64px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const roles = useAuthStore((s) => s.user?.roles) ?? NO_ROLES;
  const allowed = canOpenStaffPage("/admin/dashboard", roles);

  // null while loading; the API's counts once loaded.
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!token || !allowed) return;
    let current = true;
    getAdminStats(token)
      .then((res) => {
        if (current) setStats(res);
      })
      .catch((err) => {
        if (current) setError(err instanceof ApiError ? err.message : "We couldn't load the dashboard.");
      });
    return () => {
      current = false;
    };
  }, [token, allowed, reloads]);

  function reload() {
    setError(null);
    setStats(null);
    setReloads((n) => n + 1);
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  const verifiedShare =
    stats && stats.total_users > 0 ? `${Math.round((stats.verified_users / stats.total_users) * 100)}% of members` : undefined;

  return (
    <main className="page admin-page">
      <PageHeader
        title="Dashboard"
        subtitle="How HealAll is doing right now."
        actions={
          allowed ? (
            <button type="button" className="ghost btn-sm" onClick={reload} disabled={!stats && !error}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          ) : null
        }
      />

      {!allowed ? (
        <StaffOnly who="admins" />
      ) : error ? (
        <div className="notice notice--error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{error}</p>
          <button type="button" className="ghost btn-sm" onClick={reload}>
            Try again
          </button>
        </div>
      ) : stats === null ? (
        <DashboardSkeleton />
      ) : (
        <div className="admin-sections">
          <section className="admin-section" aria-labelledby="attention-title">
            <h2 id="attention-title" className="section-title">
              Needs attention
            </h2>
            <div className="attention-grid">
              <AttentionTile
                href="/admin/verification"
                Icon={UserCheck}
                count={stats.pending_verifications}
                one="request to verify"
                many="requests to verify"
                clear="No requests waiting for verification"
              />
              <AttentionTile
                href="/admin/moderation"
                Icon={Flag}
                count={stats.pending_reports}
                one="report to review"
                many="reports to review"
                clear="No open reports"
              />
            </div>
          </section>

          <section className="admin-section" aria-labelledby="members-title">
            <h2 id="members-title" className="section-title">
              Members
            </h2>
            <dl className="stat-grid">
              <StatTile Icon={Users} label="Members" value={stats.total_users} />
              <StatTile Icon={BadgeCheck} label="Verified" value={stats.verified_users} hint={verifiedShare} />
              <StatTile Icon={UserX} label="Suspended" value={stats.suspended_users} />
            </dl>
          </section>

          <section className="admin-section" aria-labelledby="activity-title">
            <h2 id="activity-title" className="section-title">
              Activity
            </h2>
            <dl className="stat-grid">
              <StatTile Icon={HandHeart} label="Live requests" value={stats.active_posts} />
              <StatTile Icon={FolderOpen} label="Open cases" value={stats.open_cases} />
            </dl>
          </section>
        </div>
      )}
    </main>
  );
}
