import { useSyncExternalStore } from "react";

/** Chromium's install offer (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallPlatform = "ios" | "other";
export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

let offer: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

// Chromium fires the offer once per page load, often before any component
// that wants it has mounted (e.g. on the landing page, before sign-in), so
// listen from the moment this module loads.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    offer = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    installed = true;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribeDisplayMode(listener: () => void) {
  const query = window.matchMedia?.(STANDALONE_QUERY);
  query?.addEventListener("change", listener);
  return () => query?.removeEventListener("change", listener);
}

/** True when HealAll is running as the installed app, not in a browser tab. */
function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.(STANDALONE_QUERY).matches === true;
}

function detectPlatform(): InstallPlatform {
  // iPadOS reports itself as a Mac; touch support gives it away.
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || iPadOs ? "ios" : "other";
}

function noSubscription() {
  return () => {};
}

/** Show the browser's install dialog, if it has offered one. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = offer;
  if (!event) return "unavailable";
  // An offer can only be used once.
  offer = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") {
    installed = true;
    emit();
  }
  return outcome;
}

export function useInstallState() {
  const canPrompt = useSyncExternalStore(subscribe, () => offer !== null, () => false);
  const justInstalled = useSyncExternalStore(subscribe, () => installed, () => false);
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const platform = useSyncExternalStore(noSubscription, detectPlatform, (): InstallPlatform => "other");
  return { canPrompt, justInstalled, standalone, platform };
}
