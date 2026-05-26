import { ImageResponse } from "next/og";

import { getPublicPost } from "@/lib/api/public";

export const runtime = "edge";
export const alt = "HealAll help request";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CATEGORY_EMOJI: Record<string, string> = {
  emotional_support: "🤗",
  mentorship: "🎓",
  skill_sharing: "🔧",
  navigation: "🧭",
  on_ground: "🤝",
  urgent: "🆘"
};

const URGENCY_BG: Record<string, string> = {
  low: "#e5e7eb",
  normal: "#dbeafe",
  high: "#fed7aa",
  critical: "#fecaca"
};
const URGENCY_FG: Record<string, string> = {
  low: "#374151",
  normal: "#1d4ed8",
  high: "#9a3412",
  critical: "#be123c"
};

interface RouteParams {
  params: Promise<{ postId: string }>;
}

export default async function OgImage({ params }: RouteParams) {
  const { postId } = await params;
  const post = await getPublicPost(postId);

  const title = post?.title ?? "HealAll · Mutual aid for India";
  const city = post?.city ?? "India";
  const urgency = post?.urgency ?? "normal";
  const category = post?.category ?? "on_ground";
  const emoji = CATEGORY_EMOJI[category] ?? "🤝";
  const urgencyBg = URGENCY_BG[urgency] ?? URGENCY_BG.normal;
  const urgencyFg = URGENCY_FG[urgency] ?? URGENCY_FG.normal;
  const truncated = title.length > 140 ? title.slice(0, 137).trimEnd() + "…" : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)",
          padding: "64px 72px",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #16a34a, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 30,
              fontWeight: 800
            }}
          >
            H
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#111827" }}>HealAll</div>
          <div style={{ fontSize: 22, color: "#6b7280", marginLeft: 8 }}>
            · India&apos;s mutual-aid community
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            fontSize: title.length > 80 ? 56 : 68,
            lineHeight: 1.15,
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: "-0.02em",
            display: "flex"
          }}
        >
          {truncated}
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 14, alignItems: "center" }}>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: urgencyFg,
              background: urgencyBg,
              padding: "10px 22px",
              borderRadius: 9999,
              display: "flex",
              alignItems: "center"
            }}
          >
            {urgency.toUpperCase()}
          </span>
          <span
            style={{
              fontSize: 26,
              color: "#1f2937",
              background: "#ffffffcc",
              padding: "10px 22px",
              borderRadius: 9999,
              display: "flex",
              alignItems: "center",
              gap: 10
            }}
          >
            {emoji} {category.replace(/_/g, " ")}
          </span>
          <span
            style={{
              fontSize: 26,
              color: "#1f2937",
              background: "#ffffffcc",
              padding: "10px 22px",
              borderRadius: 9999,
              display: "flex",
              alignItems: "center"
            }}
          >
            📍 {city}
          </span>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
