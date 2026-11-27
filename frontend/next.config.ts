import type { NextConfig } from "next";

const configuredMapTileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim();

function getMapTileImageSource(tileUrl: string | undefined): string | null {
  if (!tileUrl) return null;

  try {
    const url = new URL(tileUrl);
    if (url.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_MAP_TILE_URL must use https.");
    }
    return url.origin;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `NEXT_PUBLIC_MAP_TILE_URL is invalid. Received: "${tileUrl}". Please check your environment variable.`
      );
    }
    throw error;
  }
}

// Where profile photos and post attachments live. The browser PUTs uploads
// straight to S3 with a presigned URL and then shows the public object URL,
// so these origins must be in both connect-src and img-src. Both S3 URL
// styles are listed because boto3 signs path-style URLs for a custom
// endpoint while public_object_url() builds virtual-hosted ones.
// Override with NEXT_PUBLIC_MEDIA_ORIGINS (space or comma separated, https).
const DEFAULT_MEDIA_ORIGINS = [
  "https://s3.ap-south-1.amazonaws.com",
  "https://healall-media-prod.s3.ap-south-1.amazonaws.com",
];

function getMediaOrigins(raw: string | undefined): string[] {
  const values = raw?.split(/[\s,]+/).filter(Boolean) ?? [];
  if (values.length === 0) return DEFAULT_MEDIA_ORIGINS;
  return values.map((value) => {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_MEDIA_ORIGINS must use https.");
    }
    return url.origin;
  });
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Android app links file for the Play Store build, generated from env
  // (see lib/android/asset-links.ts).
  async rewrites() {
    return [{ source: "/.well-known/assetlinks.json", destination: "/android-assetlinks" }];
  },

  async headers() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://*.healallindia.com";
    // Vercel's preview-deploy toolbar (live feedback widget) only loads on
    // preview environments. Allow it explicitly so the script + iframe + WS
    // connection it ships aren't blocked there. In production these origins
    // are simply unused.
    const isVercelPreview = process.env.VERCEL_ENV === "preview";
    const vercelLiveScript = isVercelPreview ? ["https://vercel.live"] : [];
    const vercelLiveFrame = isVercelPreview ? ["https://vercel.live"] : [];
    const vercelLiveConnect = isVercelPreview
      ? ["https://vercel.live", "wss://ws-us3.pusher.com"]
      : [];

    const mediaOrigins = getMediaOrigins(process.env.NEXT_PUBLIC_MEDIA_ORIGINS);
    const mapTileImageSource = getMapTileImageSource(configuredMapTileUrl);
    // tile.openstreetmap.org is the default tile source (see map-picker.tsx).
    // Always allow it; when a paid provider is configured via
    // NEXT_PUBLIC_MAP_TILE_URL its origin is appended below.
    const mapImageSources = [
      "'self'",
      "https://*.googleusercontent.com",
      "https://tile.openstreetmap.org",
      ...(mapTileImageSource && mapTileImageSource !== "https://tile.openstreetmap.org"
        ? [mapTileImageSource]
        : []),
      ...mediaOrigins,
      "data:",
    ];

    return [
      {
        // Allow the Google Sign-In popup to postMessage back to the opener.
        // Default `same-origin` blocks the message, breaking @react-oauth/google.
        // `same-origin-allow-popups` keeps cross-origin isolation for the
        // top-level document but lets opened popups talk back.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self';",
              "base-uri 'self';",
              "object-src 'none';",
              "frame-ancestors 'self';",
              "form-action 'self';",
              // Inline event-handler attributes (onclick="...") are never used;
              // React attaches handlers itself.
              "script-src-attr 'none';",
              "upgrade-insecure-requests;",
              // 'unsafe-inline' stays in script-src: Next.js injects inline
              // bootstrap scripts, and replacing it with per-request nonces
              // needs middleware that forces every page to render dynamically
              // (no static or cached pages). Not worth that cost today.
              `script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com ${vercelLiveScript.join(" ")};`,
              `script-src-elem 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com ${vercelLiveScript.join(" ")};`,
              "style-src 'self' 'unsafe-inline' https://accounts.google.com;",
              "style-src-elem 'self' 'unsafe-inline' https://accounts.google.com;",
              // OSM tiles are allowed by default; see map-picker.tsx for the
              // tile-policy rationale. Override with NEXT_PUBLIC_MAP_TILE_URL
              // when traffic outgrows OSM's public endpoint.
              `img-src ${mapImageSources.join(" ")};`,
              // drive.google.com is required so the Community Guidelines PDF
              // iframe on the landing page can render the file/preview URL.
              `frame-src 'self' https://accounts.google.com https://drive.google.com ${vercelLiveFrame.join(" ")};`,
              `connect-src 'self' ${apiOrigin} ${mediaOrigins.join(" ")} ${vercelLiveConnect.join(" ")};`,
            ].join(' '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
