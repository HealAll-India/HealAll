import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
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
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; default-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
