import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getPushPublicKey: vi.fn(),
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));
vi.mock("@/lib/api/push", () => api);

import {
  disablePush,
  enablePush,
  getPushStatus,
  isPushSupported,
  unsubscribeThisDevice,
  urlBase64ToBytes,
} from "@/lib/push/web-push";

// A sample P-256 public key (65 bytes, base64url), as the API serves it.
const PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";

function fakeSubscription(key: ArrayBuffer | null = null, endpoint = ENDPOINT) {
  return {
    endpoint,
    options: { applicationServerKey: key },
    toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

type FakeSubscription = ReturnType<typeof fakeSubscription>;

interface Setup {
  permission?: NotificationPermission;
  answer?: NotificationPermission;
  subscription?: FakeSubscription | null;
}

/** Stand-ins for the browser's push pieces: Notification, PushManager, the service worker. */
function installBrowser({ permission = "default", answer = "granted", subscription = null }: Setup = {}) {
  const created: FakeSubscription[] = [];
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscription),
    subscribe: vi.fn(async (options: { applicationServerKey: Uint8Array }) => {
      const made = fakeSubscription(new Uint8Array(options.applicationServerKey).buffer);
      created.push(made);
      return made;
    }),
  };
  const registration = { pushManager };
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: vi.fn().mockResolvedValue(registration) },
  });
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = answer;
      return answer;
    }),
  };
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("PushManager", function PushManager() {});
  return { pushManager, notification, created };
}

describe("web push helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.savePushSubscription.mockResolvedValue(undefined);
    api.deletePushSubscription.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Reflect.deleteProperty(window.navigator, "serviceWorker");
  });

  it("reports an unsupported browser and does nothing there", async () => {
    expect(isPushSupported()).toBe(false);
    expect(await getPushStatus()).toBe("unsupported");
    expect(await enablePush("t1", PUBLIC_KEY)).toBe("unsupported");
    await unsubscribeThisDevice("t1");
    expect(api.savePushSubscription).not.toHaveBeenCalled();
    expect(api.deletePushSubscription).not.toHaveBeenCalled();
  });

  it("decodes the base64url public key", () => {
    const bytes = urlBase64ToBytes(PUBLIC_KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });

  it("reads the device's status without asking for permission", async () => {
    const blocked = installBrowser({ permission: "denied" });
    expect(await getPushStatus()).toBe("blocked");
    expect(blocked.notification.requestPermission).not.toHaveBeenCalled();

    installBrowser({ permission: "default" });
    expect(await getPushStatus()).toBe("off");

    const on = installBrowser({ permission: "granted", subscription: fakeSubscription() });
    expect(await getPushStatus()).toBe("on");
    expect(on.notification.requestPermission).not.toHaveBeenCalled();
  });

  it("asks for permission first, then subscribes and saves the subscription", async () => {
    const { pushManager, notification } = installBrowser();

    expect(await enablePush("t1", PUBLIC_KEY)).toBe("on");

    expect(notification.requestPermission).toHaveBeenCalledOnce();
    expect(notification.requestPermission.mock.invocationCallOrder[0]).toBeLessThan(
      pushManager.getSubscription.mock.invocationCallOrder[0],
    );
    const options = pushManager.subscribe.mock.calls[0][0];
    expect(options).toMatchObject({ userVisibleOnly: true });
    expect(Array.from(options.applicationServerKey)).toEqual(Array.from(urlBase64ToBytes(PUBLIC_KEY)));
    expect(api.savePushSubscription).toHaveBeenCalledWith("t1", {
      endpoint: ENDPOINT,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });
  });

  it("stops when the member says no", async () => {
    const denied = installBrowser({ answer: "denied" });
    expect(await enablePush("t1", PUBLIC_KEY)).toBe("blocked");
    expect(denied.pushManager.subscribe).not.toHaveBeenCalled();

    const dismissed = installBrowser({ answer: "default" });
    expect(await enablePush("t1", PUBLIC_KEY)).toBe("off");
    expect(dismissed.pushManager.subscribe).not.toHaveBeenCalled();
    expect(api.savePushSubscription).not.toHaveBeenCalled();
  });

  it("reuses a subscription made with the same key and replaces one made with an older key", async () => {
    const same = fakeSubscription(urlBase64ToBytes(PUBLIC_KEY).buffer);
    const reused = installBrowser({ subscription: same });
    await enablePush("t1", PUBLIC_KEY);
    expect(reused.pushManager.subscribe).not.toHaveBeenCalled();
    expect(same.unsubscribe).not.toHaveBeenCalled();

    const old = fakeSubscription(new Uint8Array(65).buffer);
    const replaced = installBrowser({ subscription: old });
    await enablePush("t1", PUBLIC_KEY);
    expect(old.unsubscribe).toHaveBeenCalledOnce();
    expect(replaced.pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it("unsubscribes again when the API can't save the subscription", async () => {
    const { created } = installBrowser();
    api.savePushSubscription.mockRejectedValueOnce(new Error("offline"));

    await expect(enablePush("t1", PUBLIC_KEY)).rejects.toThrow("offline");
    expect(created[0].unsubscribe).toHaveBeenCalledOnce();
  });

  it("turns off by forgetting the device on the API, then unsubscribing", async () => {
    const subscription = fakeSubscription();
    installBrowser({ permission: "granted", subscription });

    expect(await disablePush("t1")).toBe("off");
    expect(api.deletePushSubscription).toHaveBeenCalledWith("t1", ENDPOINT);
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it("still unsubscribes the device when the API call fails", async () => {
    const subscription = fakeSubscription();
    installBrowser({ permission: "granted", subscription });
    api.deletePushSubscription.mockRejectedValueOnce(new Error("offline"));

    await unsubscribeThisDevice("t1");
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it("unsubscribes locally without calling the API when the session is already gone", async () => {
    const subscription = fakeSubscription();
    installBrowser({ permission: "granted", subscription });

    await unsubscribeThisDevice(null);
    expect(api.deletePushSubscription).not.toHaveBeenCalled();
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it("never holds up sign-out: errors are swallowed and a hang gives up after a few seconds", async () => {
    installBrowser({ permission: "granted" });
    const worker = window.navigator.serviceWorker as unknown as { getRegistration: ReturnType<typeof vi.fn> };

    worker.getRegistration.mockRejectedValueOnce(new Error("broken"));
    await expect(unsubscribeThisDevice("t1")).resolves.toBeUndefined();

    vi.useFakeTimers();
    worker.getRegistration.mockReturnValueOnce(new Promise(() => {}));
    const done = vi.fn();
    void unsubscribeThisDevice("t1").then(done);
    await vi.advanceTimersByTimeAsync(2_900);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toHaveBeenCalledOnce();
  });
});
