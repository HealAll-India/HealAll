"use client";

import Link from "next/link";
import type { PostSummary } from "@/lib/types/api";

const CATEGORY_META: Record<string, { emoji: string; label: string; badge: string; media: string }> = {
  urgent:            { emoji: "🆘", label: "Urgent",     badge: "badge-urgent",     media: "urgent"      },
  emotional_support: { emoji: "🤗", label: "Support",    badge: "badge-support",    media: "support"     },
  mentorship:        { emoji: "🎓", label: "Mentorship", badge: "badge-mentorship", media: "mentorship"  },
  skill_sharing:     { emoji: "🔧", label: "Skills",     badge: "badge-skills",     media: "skills"      },
  navigation:        { emoji: "🧭", label: "Navigate",   badge: "badge-navigation", media: "navigation"  },
  on_ground:         { emoji: "🤝", label: "On Ground",  badge: "badge-on_ground",  media: "on_ground"   },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#16a34a,#2563eb)",
  "linear-gradient(135deg,#7c3aed,#2563eb)",
  "linear-gradient(135deg,#d97706,#e11d48)",
  "linear-gradient(135deg,#2563eb,#7c3aed)",
  "linear-gradient(135deg,#16a34a,#d97706)",
];

function avatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

function relativeTime(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1)  return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

interface Props {
  post: PostSummary;
}

export function FeedCard({ post }: Props) {
  const meta = CATEGORY_META[post.category] ?? { emoji: "📌", label: post.category, badge: "", media: "" };

  function handleShare() {
    void navigator.clipboard.writeText(window.location.origin + `/posts/${post.id}`);
  }

  return (
    <article className="card stack" style={{ marginBottom: "16px", gap: "10px" }}>
      {/* Header */}
      <div className="row" style={{ alignItems: "flex-start", gap: "10px" }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
          background: avatarGradient(post.author.name),
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: "15px",
        }}>
          {post.author.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", display: "inline-flex", alignItems: "center" }}>
            {post.author.name}
            {post.author.verification_level >= 1 && (
              <span className="vbadge">✓ Verified</span>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-subtle)", marginTop: "2px" }}>
            {post.city} · {relativeTime(post.created_at)}
          </div>
        </div>
        <span className={`badge ${meta.badge}`}>
          {meta.emoji} {meta.label.toUpperCase()}
        </span>
      </div>

      {/* Category-tinted media area */}
      <div className={`feed-card__media feed-card__media--${meta.media}`}>
        {meta.emoji}
      </div>

      {/* Title */}
      <Link href={`/posts/${post.id}`}>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--brand-green)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text)")}>
          {post.title}
        </h3>
      </Link>

      {/* Description */}
      <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: 1.55 }}>
        {truncate(post.description, 120)}
      </p>

      {/* Actions */}
      <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
        <Link href={`/posts/${post.id}`}>
          <button type="button" style={{ fontSize: "13px", padding: "8px 18px" }}>
            ♥ Offer Help
          </button>
        </Link>
        <button className="ghost" type="button" onClick={handleShare} style={{ fontSize: "12px" }}>
          ↗ Share
        </button>
        {(post.urgency === "critical" || post.urgency === "high") && (
          <span style={{
            fontSize: "11px", fontWeight: 700, marginLeft: "auto", alignSelf: "center",
            color: post.urgency === "critical" ? "var(--danger)" : "var(--warning)",
          }}>
            {post.urgency === "critical" ? "🔴 Critical" : "🟡 High urgency"}
          </span>
        )}
      </div>
    </article>
  );
}
