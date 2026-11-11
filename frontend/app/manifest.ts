import type { MetadataRoute } from "next";

/**
 * Web app manifest, served at /manifest.webmanifest. Lets members install
 * HealAll to their home screen (and is what a Play Store wrapper reads).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HealAll",
    short_name: "HealAll",
    description: "India's invite-only mutual-aid community. Request help or offer it.",
    // The landing page sends signed-in members on to /feed.
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF8F4",
    theme_color: "#FAF8F4",
    lang: "en-IN",
    dir: "ltr",
    categories: ["social", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Ask for help",
        url: "/posts/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Messages",
        url: "/messages",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
