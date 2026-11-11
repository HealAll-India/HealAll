"use client";

import { useState } from "react";
import { CircleCheck, Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { useHydrated } from "@/lib/hooks/use-hydrated";

import { promptInstall, useInstallState, type InstallOutcome } from "./install-state";

/** /install: put HealAll on the home screen, with steps for each browser. */
export function InstallGuide() {
  const hydrated = useHydrated();
  const { canPrompt, justInstalled, standalone, platform } = useInstallState();
  const [outcome, setOutcome] = useState<InstallOutcome | null>(null);

  async function install() {
    setOutcome(await promptInstall());
  }

  let body: React.ReactNode;
  if (!hydrated) {
    body = null;
  } else if (standalone) {
    body = <Done>You&apos;re already using the HealAll app.</Done>;
  } else if (justInstalled) {
    body = <Done>HealAll is on your home screen. Open it from there next time.</Done>;
  } else if (canPrompt) {
    body = (
      <button type="button" className="install-cta" onClick={() => void install()}>
        <Download size={20} aria-hidden="true" /> Install HealAll
      </button>
    );
  } else if (platform === "ios") {
    body = (
      <ol className="install-steps">
        <li>
          <Share size={20} aria-hidden="true" />
          <span>
            Tap <strong>Share</strong>. In Safari it&apos;s at the bottom of the screen.
          </span>
        </li>
        <li>
          <SquarePlus size={20} aria-hidden="true" />
          <span>
            Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
          </span>
        </li>
      </ol>
    );
  } else {
    body = (
      <ol className="install-steps">
        <li>
          <EllipsisVertical size={20} aria-hidden="true" />
          <span>
            Open your browser&apos;s menu and choose <strong>Install app</strong> or{" "}
            <strong>Add to Home screen</strong>.
          </span>
        </li>
        <li>
          <Download size={20} aria-hidden="true" />
          <span>
            Don&apos;t see it? Open <strong>healallindia.com</strong> in Chrome on Android, or Safari on iPhone.
          </span>
        </li>
      </ol>
    );
  }

  return (
    <div className="install">
      <PageHeader
        title="Get the HealAll app"
        subtitle="Open HealAll from your home screen like any other app. No app store, and it's the same account, requests and messages."
      />
      <div aria-live="polite">{body}</div>
      {outcome === "dismissed" ? (
        <p className="install-note">No problem. You can install it from this page any time.</p>
      ) : null}
      <p className="install-note">
        On a shared phone? Sign out from the account menu when you&apos;re done, just as on the website.
      </p>
    </div>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice notice--success" role="status">
      <CircleCheck size={18} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
