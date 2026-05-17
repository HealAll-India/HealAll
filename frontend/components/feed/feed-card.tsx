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

  const initials = post.author.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarBg = avatarGradient(post.author.name);

  return (
    <article className="fcard">
      {/* Header */}
      <div className="fcard__top">
        <span
          className="av av-md"
          style={{ background: avatarBg }}
        >
          {initials}
        </span>
        <div className="fcard__who">
          <div className="fcard__name">
            {post.author.name}
            {post.author.verification_level >= 1 && (
              <span className="vpill">✓ Verified</span>
            )}
          </div>
          <div className="fcard__meta">
            <span>📍 {post.city}</span>
            <span>·</span>
            <span>{relativeTime(post.created_at)}</span>
          </div>
        </div>
        <span className={`cbadge cbadge--${post.category}`}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* Title */}
      <Link href={`/posts/${post.id}`}>
        <h3 className="fcard__title">{post.title}</h3>
      </Link>

      {/* Description */}
      <p className="fcard__desc">{truncate(post.description, 140)}</p>

      {/* Actions */}
      <div className="fcard__actions">
        <Link href={`/posts/${post.id}`}>
          <button type="button" className="btn-sm">♥ Offer Help</button>
        </Link>
        <button className="ghost btn-sm" type="button" onClick={handleShare}>↗ Share</button>
        {post.urgency === "critical" && (
          <span className="urgency-pill" style={{ marginLeft: "auto" }}>
            <span className="urgency-pill__dot" />
            Critical
          </span>
        )}
        {post.urgency === "high" && (
          <span style={{ fontSize: "11px", fontWeight: 700, marginLeft: "auto", color: "var(--warning)" }}>
            🟡 High urgency
          </span>
        )}
      </div>
    </article>
  );
}
