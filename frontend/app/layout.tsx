import type { Metadata, Viewport } from "next";
import { Fraunces, Noto_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Self-hosted at build time (CSP-safe: no request to Google at runtime).
// Noto Sans ships Devanagari in the same family; next/font emits a
// unicode-range per subset, so the Devanagari file only downloads when
// Hindi text is actually on the page.
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext", "devanagari"],
  weight: "variable",
  display: "swap",
  variable: "--font-noto-sans-face",
});

// Display face for page titles only — one static weight keeps it small.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  variable: "--font-fraunces-face",
});

export const metadata: Metadata = {
  title: "HealAll — Helping in Any Way Possible",
  description: "India's invite-only mutual-aid community. Request help or offer it — medicine, shelter, food, finance, and more.",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
  },
  metadataBase: new URL("https://healallindia.com"),
  openGraph: {
    title: "HealAll — Helping in Any Way Possible",
    description: "India's invite-only mutual-aid community.",
    url: "https://healallindia.com",
    siteName: "HealAll",
    images: [{ url: "https://healallindia.com/favicon-512.png", width: 512, height: 512 }],
    locale: "en_IN",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF8F4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${notoSans.variable} ${fraunces.variable}`}>
      <body>
        <GoogleAuthProvider>
          <AppShell>{children}</AppShell>
        </GoogleAuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
