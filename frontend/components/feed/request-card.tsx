import Link from "next/link";
import { MapPin } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { CategoryBadge, UrgencyBadge } from "@/components/ui/post-badges";
import { ShareButton } from "@/components/ui/share-button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { relativeTime } from "@/lib/format";
import type { PostSummary } from "@/lib/types/api";


/**
 * One request in the feed. Fixed slot order: urgency/category/time → title →
 * two-line description → city → author + share + "I can help". The title
 * link stretches over the whole card; the badge, share and help controls
 * sit above it. On the member's own request the CTA is "View" instead.
 */
export function RequestCard({ post, viewerId }: { post: PostSummary; viewerId?: string }) {
  const href = `/posts/${post.id}`;
  const own = viewerId !== undefined && post.author.id === viewerId;
  return (
    <article className="feed-card">
      <div className="feed-card__top">
        <UrgencyBadge urgency={post.urgency} />
        <CategoryBadge category={post.category} />
        <time className="feed-card__time" dateTime={post.created_at}>
          {relativeTime(post.created_at)}
        </time>
      </div>

      <h2 className="feed-card__title">
        <Link href={href} className="feed-card__link">
          {post.title}
        </Link>
      </h2>

      <p className="feed-card__desc">{post.description}</p>

      {post.city ? (
        <div className="meta-row">
          <span className="meta-row__item">
            <MapPin size={16} aria-hidden="true" />
            {post.city}
          </span>
        </div>
      ) : null}

      <div className="feed-card__footer">
        <Avatar name={post.author.name} size="md" />
        <div className="feed-card__author">
          <span className="feed-card__name">{post.author.name}</span>
          <VerifiedBadge level={post.author.verification_level} />
        </div>
        <ShareButton path={href} title={post.title} outline />
        {own ? (
          <Link href={href} className="btn-secondary feed-card__help" aria-label={`View your request: ${post.title}`}>
            View
          </Link>
        ) : (
          <Link href={`${href}#help`} className="btn-primary feed-card__help">
            I can help
          </Link>
        )}
      </div>
    </article>
  );
}
