import type { Metadata } from "next";

import { InstallGuide } from "@/components/pwa/install-guide";

export const metadata: Metadata = {
  title: "Get the app · HealAll",
  description: "Add HealAll to your phone's home screen. No app store needed.",
};

export default function InstallPage() {
  return (
    <main className="install-page">
      <InstallGuide />
    </main>
  );
}
