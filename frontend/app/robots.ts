import type { MetadataRoute } from "next";

const SITE_URL = "https://healallindia.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth-only and admin routes have nothing useful for crawlers and
        // they 404 / redirect anonymously anyway; keep them out of the
        // index to save crawl budget for the public surfaces.
        disallow: [
          "/admin",
          "/admin/",
          "/invites",
          "/messages",
          "/messages/",
          "/cases",
          "/cases/",
          "/profile",
          "/profile/",
          "/verify",
          "/verify-otp",
          "/signup/otp",
          "/feed"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
