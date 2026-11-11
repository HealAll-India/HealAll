import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf-8");

type Handler = (event: Record<string, unknown>) => void;

/** Run public/sw.js against stub worker globals and return its handlers. */
function loadWorker(fetchImpl: (req: unknown) => Promise<unknown>, cachedOffline: unknown = "offline-page") {
  const handlers: Record<string, Handler> = {};
  const cache = { add: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(["healall-offline-v0", "healall-offline-v1", "something-else"]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(cachedOffline),
  };
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    registration: { navigationPreload: { enable: vi.fn().mockResolvedValue(undefined) } },
  };
  class Request {
    constructor(
      public url: string,
      public init: Record<string, unknown>,
    ) {}
  }
  const fetch = vi.fn(fetchImpl);
  vm.runInNewContext(SOURCE, { self, caches, fetch, Request, Response: { error: () => "network-error" } });
  return { handlers, cache, caches, self, fetch };
}

function lifecycleEvent() {
  let pending: Promise<unknown> = Promise.resolve();
  return { event: { waitUntil: (p: Promise<unknown>) => (pending = p) }, done: () => pending };
}

function navigation(mode: string, preloadResponse?: unknown) {
  let response: Promise<unknown> | undefined;
  const event = {
    request: { mode, url: "https://healallindia.com/feed" },
    preloadResponse: Promise.resolve(preloadResponse),
    respondWith: (p: Promise<unknown>) => (response = p),
  };
  return { event, response: () => response };
}

describe("service worker", () => {
  it("caches only the offline page on install, bypassing the HTTP cache", async () => {
    const { handlers, cache, self } = loadWorker(() => Promise.resolve("network"));
    const { event, done } = lifecycleEvent();
    handlers.install(event);
    await done();
    expect(cache.add).toHaveBeenCalledOnce();
    expect(cache.add.mock.calls[0][0]).toMatchObject({ url: "/offline.html", init: { cache: "reload" } });
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it("drops older caches and enables navigation preload on activate", async () => {
    const { handlers, caches, self } = loadWorker(() => Promise.resolve("network"));
    const { event, done } = lifecycleEvent();
    handlers.activate(event);
    await done();
    expect(caches.delete.mock.calls.map(([key]) => key)).toEqual(["healall-offline-v0", "something-else"]);
    expect(self.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it("leaves everything except page loads alone", () => {
    const { handlers } = loadWorker(() => Promise.resolve("network"));
    const { event, response } = navigation("cors");
    handlers.fetch(event);
    expect(response()).toBeUndefined();
  });

  it("serves page loads from the network, using the preloaded response when there is one", async () => {
    const online = loadWorker(() => Promise.resolve("network"));
    const plain = navigation("navigate");
    online.handlers.fetch(plain.event);
    expect(await plain.response()).toBe("network");

    const preloaded = navigation("navigate", "preloaded");
    online.handlers.fetch(preloaded.event);
    expect(await preloaded.response()).toBe("preloaded");
    expect(online.fetch).toHaveBeenCalledOnce();
  });

  it("shows the offline page when a page load fails", async () => {
    const { handlers, caches } = loadWorker(() => Promise.reject(new TypeError("Failed to fetch")));
    const { event, response } = navigation("navigate");
    handlers.fetch(event);
    expect(await response()).toBe("offline-page");
    expect(caches.match).toHaveBeenCalledWith("/offline.html");
  });
});
