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

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self';",
              "base-uri 'self';",
              "object-src 'none';",
              "frame-ancestors 'none';",
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
              `frame-src https://accounts.google.com https://drive.google.com ${vercelLiveFrame.join(" ")};`,
              `connect-src 'self' ${apiOrigin} ${vercelLiveConnect.join(" ")};`,
            ].join(' '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
