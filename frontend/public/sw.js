/* HealAll service worker: an offline page for page loads, and push
 * notifications. Nothing else.
 *
 * It deliberately caches no pages or API responses. Feeds, messages and
 * profiles are personal, and phones are often shared, so nothing a member
 * saw should stay on the device after they sign out. Bump CACHE when
 * offline.html changes.
 *
 * Notifications carry no message, comment or post text (lock screens are
 * public): a title, a line naming who did what, and a same-site path to open.
 */
const CACHE = "healall-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      // Start the page request while this worker boots, so it adds no delay.
      .then(() => self.registration.navigationPreload && self.registration.navigationPreload.enable())
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        return preloaded || (await fetch(event.request));
      } catch {
        const offline = await caches.match(OFFLINE_URL);
        return offline || Response.error();
      }
    })(),
  );
});

// ── Push notifications ──────────────────────────────────────────────────────

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-192.png";

/** A same-origin path to open, or "/" for anything else: never another site. */
function sameOriginPath(url) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return "/";
  try {
    const target = new URL(url, self.location.origin);
    return target.origin === self.location.origin ? target.pathname + target.search + target.hash : "/";
  } catch {
    return "/";
  }
}

function text(value, fallback, max) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

/** The payload is {title, body, url, tag}; anything malformed still shows a plain notification. */
function readPayload(data) {
  let payload = null;
  try {
    payload = data ? data.json() : null;
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== "object") payload = {};
  return {
    title: text(payload.title, "HealAll", 80),
    body: text(payload.body, "You have a new update on HealAll", 160),
    url: sameOriginPath(payload.url),
    tag: text(payload.tag, "", 100),
  };
}

self.addEventListener("push", (event) => {
  // The subscription promised the browser every push shows a notification.
  const { title, body, url, tag } = readPayload(event.data);
  const options = { body, icon: ICON, badge: BADGE, data: { url } };
  if (tag) {
    // One notification per conversation or post, refreshed rather than stacked.
    options.tag = tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data;
  const target = new URL(sameOriginPath(data && data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          const navigated = await client.navigate(target);
          await (navigated || client).focus();
          return;
        } catch {
          // Not this window (e.g. not controlled by this worker): try the next.
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
