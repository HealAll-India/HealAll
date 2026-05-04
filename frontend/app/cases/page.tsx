"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { listCases } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CaseListResponse, CaseResponse } from "@/lib/types/api";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open:            { bg: "#dbeafe", color: "#1d4ed8" },
  in_progress:     { bg: "#fef3c7", color: "#92400e" },
  pending_closure: { bg: "#ffedd5", color: "#9a3412" },
  closed:          { bg: "#f3f4f6", color: "#6b7280" },
  invalid:         { bg: "#fee2e2", color: "#dc2626" },
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high:     "#d97706",
  medium:   "#2563eb",
  low:      "#6b7280",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function CaseCard({ item }: { item: CaseResponse }) {
  return (
    <Link href={`/cases/${item.id}`} style={{ textDecoration: "none" }}>
      <div
        className="card stack"
        style={{ padding: "16px 20px", cursor: "pointer", gap: "10px" }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
            {item.post.title}
          </h3>
          <StatusBadge status={item.status} />
        </div>

        <div className="row" style={{ gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>📍 {item.post.city}</span>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>🏷 {item.post.category}</span>
          <span style={{ fontSize: "12px", color: URGENCY_COLORS[item.post.urgency] ?? "#6b7280", fontWeight: 600 }}>
            ⚡ {item.post.urgency}
          </span>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            🙋 {item.helper_count} helper{item.helper_count !== 1 ? "s" : ""}
          </span>
        </div>

        {item.owner && (
          <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
            Owner: {item.owner.name}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function CasesPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);

  const [data, setData] = useState<CaseListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listCases(token, 1, 20)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load cases"))
      .finally(() => setLoading(false));
  }, [token]);

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  return (
    <main className="page">
      <section className="card stack" style={{ marginBottom: "16px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>Cases</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
              Active mutual-aid cases visible to you
            </p>
          </div>
          {data && (
            <span style={{ fontSize: "13px", color: "#6b7280" }}>
              {data.total} case{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </section>

      {loading ? (
        <section className="card"><p className="muted">Loading cases…</p></section>
      ) : error ? (
        <section className="card"><p className="error">{error}</p></section>
      ) : !data || data.items.length === 0 ? (
        <section className="card stack" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p style={{ fontSize: "32px", margin: 0 }}>📋</p>
          <p style={{ fontWeight: 600, margin: "8px 0 4px" }}>No cases yet</p>
          <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
            Cases are created from submitted posts. Check the{" "}
            <Link href="/feed" style={{ color: "#16a34a" }}>feed</Link> for active requests.
          </p>
        </section>
      ) : (
        <div className="stack" style={{ gap: "10px" }}>
          {data.items.map((item) => (
            <CaseCard key={item.id} item={item} />
          ))}
          {data.has_next && (
            <p className="muted" style={{ textAlign: "center", fontSize: "13px" }}>
              Showing {data.items.length} of {data.total} cases
            </p>
          )}
        </div>
      )}
    </main>
  );
}
