"use client";

import Link from "next/link";
import type { FeedFilters, FeedResponse } from "@/lib/types/api";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#16a34a,#2563eb)",
  "linear-gradient(135deg,#7c3aed,#2563eb)",
  "linear-gradient(135deg,#d97706,#e11d48)",
];

interface Props {
  feedResult:     FeedResponse | null;
  filters:        FeedFilters;
  onFilterChange: (partial: Partial<FeedFilters>) => void;
}

export function FeedSidebar({ feedResult, filters, onFilterChange }: Props) {
  const items = feedResult?.items ?? [];
  const cities        = Array.from(new Set(items.map(p => p.city))).sort();
  const uniqueHelpers = new Set(items.map(p => p.author.id)).size;
  const citiesCount   = new Set(items.map(p => p.city)).size;
  const recentAuthors = Array.from(
    new Map(items.map(p => [p.author.id, p])).values()
  ).slice(0, 3);

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      <div className="card stack" style={{ borderRadius: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Search & Filter</h3>
        <input
          value={filters.search}
          onChange={e => onFilterChange({ search: e.target.value })}
          placeholder="Search posts…"
          style={{ fontSize: "12px" }}
        />
        <div className="row" style={{ gap: "6px", flexWrap: "wrap" }}>
          {([
            { label: "All",      value: "" },
            { label: "🟡 High",  value: "high" },
            { label: "🔴 Critical", value: "critical" },
          ] as const).map(chip => (
            <button
              key={chip.label}
              type="button"
              className={`chip${filters.urgency === chip.value ? " active" : ""}`}
              onClick={() => onFilterChange({ urgency: chip.value })}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <select
          value={filters.city}
          onChange={e => onFilterChange({ city: e.target.value })}
          style={{ fontSize: "12px" }}
        >
          <option value="">All cities</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      <div className="card stack" style={{ borderRadius: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Community</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#6b7280" }}>Active posts</span>
          <span style={{ fontWeight: 700 }}>{feedResult?.total ?? "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#6b7280" }}>Unique helpers</span>
          <span style={{ fontWeight: 700, color: "#16a34a" }}>{uniqueHelpers || "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#6b7280" }}>Cities covered</span>
          <span style={{ fontWeight: 700 }}>{citiesCount || "—"}</span>
        </div>
      </div>

      {recentAuthors.length > 0 && (
        <div className="card stack" style={{ borderRadius: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Recent helpers</h3>
          {recentAuthors.map((post, i) => (
            <div key={post.author.id} className="row" style={{ gap: "10px", alignItems: "center" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "13px",
              }}>
                {post.author.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {post.author.name}
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>{post.city}</div>
              </div>
              <Link href={`/posts/${post.id}`}>
                <button type="button" className="secondary" style={{ fontSize: "11px", padding: "4px 10px" }}>
                  View
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}

    </aside>
  );
}
