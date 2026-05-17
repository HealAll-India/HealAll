import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GoogleAuthProvider>
          <AppShell>{children}</AppShell>
        </GoogleAuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
