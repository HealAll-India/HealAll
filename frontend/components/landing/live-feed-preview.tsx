import Link from "next/link";

import { getPublicFeed } from "@/lib/api/public";

const CATEGORY_LABEL: Record<string, string> = {
  emotional_support: "🤗 Support",
  mentorship: "🎓 Mentorship",
  skill_sharing: "🔧 Skills",
  navigation: "🧭 Navigate",
  on_ground: "🤝 On Ground",
  urgent: "🆘 Urgent"
};

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function LiveFeedPreview({ limit = 3 }: { limit?: number }) {
  const feed = await getPublicFeed({ page: 1, per_page: limit });
  const items = feed?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="miniposts">
        <div className="minipost minipost--empty">
          Community waking up — check back in a moment.
        </div>
      </div>
    );
  }

  return (
    <div className="miniposts">
      {items.map((p) => (
        <Link
          key={p.id}
          href={`/posts/${p.id}`}
          className="minipost minipost--link"
        >
          <span className="av av-sm minipost__av" aria-hidden="true">
            {initialsFor(p.author.name)}
          </span>
          <div>
            <div className="minipost__who">
              {p.author.name} · {p.city}
            </div>
            <div className="minipost__title">{p.title}</div>
            <div className="minipost__meta">
              {CATEGORY_LABEL[p.category] ?? p.category} · {p.helper_count} helping
            </div>
          </div>
          <span className="minipost__cta">♥ Help</span>
        </Link>
      ))}
    </div>
  );
}
