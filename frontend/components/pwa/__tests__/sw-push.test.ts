import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf-8");
const ORIGIN = "https://healallindia.com";

type Handler = (event: Record<string, unknown>) => void;

interface FakeWindow {
  url: string;
  navigate: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

function fakeWindow(url: string): FakeWindow {
  const win: FakeWindow = { url, navigate: vi.fn(), focus: vi.fn().mockResolvedValue(undefined) };
  win.navigate.mockImplementation(async () => win);
  return win;
}

/** Run public/sw.js against stub worker globals and return its handlers. */
function loadWorker(windows: FakeWindow[] = []) {
  const handlers: Record<string, Handler> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow: vi.fn().mockResolvedValue(null),
    },
  };
  vm.runInNewContext(SOURCE, { self, URL, caches: {}, fetch: vi.fn() });
  return { handlers, self };
}

function pushEvent(data: unknown) {
  let pending: Promise<unknown> = Promise.resolve();
  const event = {
    data:
      data === undefined
        ? null
        : {
            json: () => (typeof data === "string" ? JSON.parse(data) : data),
          },
    waitUntil: (p: Promise<unknown>) => (pending = p),
  };
  return { event, done: () => pending };
}

function clickEvent(data: unknown) {
  let pending: Promise<unknown> = Promise.resolve();
  const notification = { data, close: vi.fn() };
  const event = { notification, waitUntil: (p: Promise<unknown>) => (pending = p) };
  return { event, notification, done: () => pending };
}

describe("service worker push notifications", () => {
  it("shows the notification the API sent, with the app icon", async () => {
    const { handlers, self } = loadWorker();
    const { event, done } = pushEvent({
      title: "New message",
      body: "Priya sent you a message",
      url: "/messages/c1",
      tag: "conversation-c1",
    });
    handlers.push(event);
    await done();

    expect(self.registration.showNotification).toHaveBeenCalledWith("New message", {
      body: "Priya sent you a message",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: "/messages/c1" },
      tag: "conversation-c1",
      renotify: true,
    });
  });

  it("still shows a plain notification for a missing or malformed payload", async () => {
    for (const data of [undefined, "not json {", ["a list"], { title: 42, body: null }]) {
      const { handlers, self } = loadWorker();
      const { event, done } = pushEvent(data);
      handlers.push(event);
      await done();

      const [title, options] = self.registration.showNotification.mock.calls[0];
      expect(title).toBe("HealAll");
      expect(options).toMatchObject({ body: "You have a new update on HealAll", data: { url: "/" } });
      expect(options).not.toHaveProperty("tag");
    }
  });

  it("never links a notification to another site", async () => {
    for (const url of ["https://evil.example.com/x", "//evil.example.com/x", "/\\evil.example.com", "javascript:alert(1)"]) {
      const { handlers, self } = loadWorker();
      const { event, done } = pushEvent({ title: "t", body: "b", url });
      handlers.push(event);
      await done();
      expect(self.registration.showNotification.mock.calls[0][1].data).toEqual({ url: "/" });
    }
  });

  it("opens the notification's page in a window that is already open", async () => {
    const other = fakeWindow("https://elsewhere.example.com/");
    const app = fakeWindow(`${ORIGIN}/feed`);
    const { handlers, self } = loadWorker([other, app]);
    const { event, notification, done } = clickEvent({ url: "/messages/c1" });
    handlers.notificationclick(event);
    await done();

    expect(notification.close).toHaveBeenCalled();
    expect(other.navigate).not.toHaveBeenCalled();
    expect(app.navigate).toHaveBeenCalledWith(`${ORIGIN}/messages/c1`);
    expect(app.focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when none is open, and only on this site", async () => {
    const { handlers, self } = loadWorker();
    const { event, done } = clickEvent({ url: "/posts/p1" });
    handlers.notificationclick(event);
    await done();
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/posts/p1`);

    const tampered = loadWorker();
    const evil = clickEvent({ url: "https://evil.example.com/" });
    tampered.handlers.notificationclick(evil.event);
    await evil.done();
    expect(tampered.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("falls back to a new window when an open one can't be navigated", async () => {
    const stuck = fakeWindow(`${ORIGIN}/feed`);
    stuck.navigate.mockRejectedValue(new TypeError("not controlled"));
    const { handlers, self } = loadWorker([stuck]);
    const { event, done } = clickEvent({ url: "/cases/k1" });
    handlers.notificationclick(event);
    await done();
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/cases/k1`);
  });
});
