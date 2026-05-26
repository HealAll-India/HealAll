import type { Metadata } from "next";

import PostDetailClient from "./post-detail-client";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicPost } from "@/lib/api/public";

const SITE_URL = "https://healallindia.com";

const CATEGORY_LABEL: Record<string, string> = {
  emotional_support: "Emotional Support",
  mentorship: "Mentorship",
  skill_sharing: "Skill Sharing",
  navigation: "Navigation",
  on_ground: "On-Ground Help",
  urgent: "Urgent Help"
};

const URGENCY_LABEL: Record<string, string> = {
  low: "Low priority",
  normal: "Standard",
  high: "High priority",
  critical: "Critical"
};

interface RouteParams {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPublicPost(postId);

  if (!post) {
    return {
      title: "Post not available · HealAll",
      description: "This help request is no longer publicly visible.",
      robots: { index: false, follow: false }
    };
  }

  const urgency = URGENCY_LABEL[post.urgency] ?? post.urgency;
  const category = CATEGORY_LABEL[post.category] ?? post.category;
  const title = `${post.title} · HealAll`;
  const snippet = post.description.length > 160
    ? post.description.slice(0, 157).trimEnd() + "…"
    : post.description;
  const description = `${urgency} · ${category} · ${post.city}. ${snippet}`;
  const url = `${SITE_URL}/posts/${postId}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "HealAll",
      locale: "en_IN",
      type: "article"
      // OG image is auto-discovered from ./opengraph-image.tsx by Next.
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function PostDetailPage({ params }: RouteParams) {
  const { postId } = await params;
  const post = await getPublicPost(postId);

  // Article-ish schema. We use SocialMediaPosting (a subtype of Article)
  // because the help request is essentially a public social post; the
  // location is encoded as a Place to help Google surface it on Maps
  // alongside the post.
  const jsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        "headline": post.title,
        "articleBody": post.description,
        "datePublished": post.created_at,
        "inLanguage": "en-IN",
        "isAccessibleForFree": true,
        "author": {
          "@type": "Person",
          "name": post.author.name
        },
        "publisher": {
          "@type": "Organization",
          "name": "HealAll",
          "url": SITE_URL
        },
        "contentLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": post.city,
            "addressCountry": "IN"
          }
        },
        "url": `${SITE_URL}/posts/${postId}`
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} id={`ld-post-${postId}`} />}
      <PostDetailClient />
    </>
  );
}
