import type { NextConfig } from "next";

const configuredMapTileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim();
const isProductionBuild = process.env.NODE_ENV === "production";

function getMapTileImageSource(tileUrl: string | undefined): string | null {
  if (!tileUrl) return null;

  const url = new URL(tileUrl);
  if (url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_MAP_TILE_URL must use https.");
  }

  return url.origin;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://*.healallindia.com";
    const mapTileImageSource = getMapTileImageSource(configuredMapTileUrl);
    const mapImageSources = [
      "'self'",
      "https://*.googleusercontent.com",
      ...(mapTileImageSource ? [mapTileImageSource] : []),
      ...(!isProductionBuild && !mapTileImageSource ? ["https://tile.openstreetmap.org"] : []),
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
              "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com;",
              "style-src 'self' 'unsafe-inline' https://accounts.google.com;",
              "style-src-elem 'self' 'unsafe-inline' https://accounts.google.com;",
              // Public OSM tiles are donation-funded/rate-limited. Keep them
              // local-dev only, preserve visible attribution, and set
              // NEXT_PUBLIC_MAP_TILE_URL for production (MapTiler, Mapbox, or
              // a self-hosted/CDN tile endpoint).
              `img-src ${mapImageSources.join(" ")};`,
              "frame-src https://accounts.google.com;",
              `connect-src 'self' ${apiOrigin};`,
            ].join(' '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
