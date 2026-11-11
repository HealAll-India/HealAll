"use client";

import { useEffect } from "react";

// Imported for its side effect: start listening for the install offer.
import "./install-state";

/**
 * Registers the service worker that shows an offline page. Production only,
 * so development never serves a stale worker.
 */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Non-fatal: the site works the same, minus the offline page.
    });
  }, []);
  return null;
}
