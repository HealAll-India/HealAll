import type { MetadataRoute } from "next";

import { getPublicFeed } from "@/lib/api/public";

const SITE_URL = "https://healallindia.com";

// Soft cap on how many ACTIVE posts we walk into the sitemap. 250 covers
// 99% of the catalog at current scale; bump when the feed grows.
const MAX_POSTS = 250;
const PAGE_SIZE = 50;

// Regenerate sitemap once an hour. The post list itself is far slower-moving
// than the landing-page stats; an hour avoids hammering the backend while
// still surfacing fresh items quickly enough for search crawlers.
export const revalidate = 3600;

interface PostSitemapEntry {
  id: string;
  created_at: string;
}

async function collectActivePosts(): Promise<PostSitemapEntry[]> {
  const out: PostSitemapEntry[] = [];
  let page = 1;
  while (out.length < MAX_POSTS) {
    const res = await getPublicFeed({ page, per_page: PAGE_SIZE });
    if (!res || res.items.length === 0) break;
    for (const item of res.items) {
      out.push({ id: item.id, created_at: item.created_at });
      if (out.length >= MAX_POSTS) break;
    }
    if (!res.has_next) break;
    page += 1;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${SITE_URL}/contributors`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/privacy-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 }
  ];

  // Fail open on backend hiccups — emitting just the static block is much
  // better than 500ing the sitemap fetch.
  let posts: PostSitemapEntry[] = [];
  try {
    posts = await collectActivePosts();
  } catch {
    posts = [];
  }

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/posts/${p.id}`,
    lastModified: p.created_at ? new Date(p.created_at) : now,
    changeFrequency: "daily",
    priority: 0.8
  }));

  return [...staticEntries, ...postEntries];
}
