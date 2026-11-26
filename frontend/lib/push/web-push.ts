/**
 * Web push for this device: check, turn on, turn off.
 *
 * Notifications arrive through the service worker (public/sw.js), in the
 * browser and in the Android app alike (a Trusted Web Activity over Chrome).
 * The permission prompt is only ever asked for from a tap: `enablePush` must
 * be called straight from a click handler.
 */
import { deletePushSubscription, savePushSubscription } from "@/lib/api/push";

export type PushStatus = "on" | "off" | "blocked" | "unsupported";

/** How long to wait for the service worker, which registers on page load (production only). */
const WORKER_READY_TIMEOUT_MS = 4_000;

/** Sign-out waits this long at most for the device to unsubscribe. */
const SIGN_OUT_TIMEOUT_MS = 3_000;

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Whether this browser can receive web push at all. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The active service worker registration, or null if none shows up in time. */
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return Promise.race([navigator.serviceWorker.ready, timeout(WORKER_READY_TIMEOUT_MS, null)]);
}

/** The base64url VAPID public key as the bytes PushManager.subscribe takes. */
export function urlBase64ToBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameBytes(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const view = new Uint8Array(a);
  return view.length === b.length && view.every((byte, i) => byte === b[i]);
}

/** Where this device stands: on, off, blocked in browser settings, or unsupported. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await readyRegistration();
  if (!registration) return "unsupported";
  const subscription = await registration.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

/**
 * Ask for permission, subscribe this device and save it for the signed-in
 * member. Call it straight from a tap: the permission request comes first,
 * before anything else is awaited, so browsers that need a user gesture
 * still show the prompt.
 */
export async function enablePush(token: string, publicKey: string): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";

  const registration = await readyRegistration();
  if (!registration) return "unsupported";

  const key = urlBase64ToBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameBytes(subscription.options.applicationServerKey, key)) {
    // Made with an older key: the browser refuses a new one until it's gone.
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  try {
    if (!json.endpoint || !p256dh || !auth) throw new Error("Incomplete push subscription");
    await savePushSubscription(token, { endpoint: json.endpoint, keys: { p256dh, auth } });
  } catch (error) {
    // Don't leave the device looking "on" when the API doesn't know about it.
    await subscription.unsubscribe().catch(() => false);
    throw error;
  }
  return "on";
}

/** Turn notifications off for this device: forget it on the API, then unsubscribe. */
export async function disablePush(token: string | null): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    if (token) {
      // If this fails, unsubscribing still stops delivery: the API drops the
      // endpoint the next time the push service reports it gone.
      await deletePushSubscription(token, subscription.endpoint).catch(() => undefined);
    }
    await subscription.unsubscribe().catch(() => false);
  }
  return Notification.permission === "denied" ? "blocked" : "off";
}

/**
 * On sign-out: stop this device getting the member's notifications, so a
 * shared phone doesn't keep showing them to the next person. Never rejects
 * and gives up after a few seconds, so it can't hold up signing out.
 */
export async function unsubscribeThisDevice(token: string | null): Promise<void> {
  if (!isPushSupported()) return;
  const attempt = disablePush(token).then(
    () => undefined,
    () => undefined,
  );
  await Promise.race([attempt, timeout(SIGN_OUT_TIMEOUT_MS, undefined)]);
}
