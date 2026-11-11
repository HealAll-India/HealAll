/* HealAll service worker: an offline page for page loads, nothing else.
 *
 * It deliberately caches no pages or API responses. Feeds, messages and
 * profiles are personal, and phones are often shared, so nothing a member
 * saw should stay on the device after they sign out. Bump CACHE when
 * offline.html changes.
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
