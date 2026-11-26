import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

const api = vi.hoisted(() => ({
  getPushPublicKey: vi.fn(),
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));
vi.mock("@/lib/api/push", () => api);

const push = vi.hoisted(() => ({
  isPushSupported: vi.fn(),
  getPushStatus: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
}));
vi.mock("@/lib/push/web-push", () => push);

import { NotificationsCard } from "@/components/profile/notifications-card";

const PRIYA = { id: "u1", name: "Priya Sharma" } as UserInfo;

function stubPermission(permission: NotificationPermission) {
  const requestPermission = vi.fn();
  vi.stubGlobal("Notification", { permission, requestPermission });
  return requestPermission;
}

function toggle() {
  return screen.getByRole("switch", { name: /notifications on this device/i }) as HTMLInputElement;
}

describe("NotificationsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession("t1", PRIYA);
    push.isPushSupported.mockReturnValue(true);
    api.getPushPublicKey.mockResolvedValue({ enabled: true, public_key: "server-key" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("says when the device can't get notifications, without calling the API", async () => {
    push.isPushSupported.mockReturnValue(false);
    render(<NotificationsCard />);

    expect(await screen.findByText("Not supported on this device")).toBeTruthy();
    expect(toggle().disabled).toBe(true);
    expect(api.getPushPublicKey).not.toHaveBeenCalled();
  });

  it("explains how to unblock notifications blocked in browser settings", async () => {
    stubPermission("denied");
    render(<NotificationsCard />);

    expect(await screen.findByText("Blocked in browser settings")).toBeTruthy();
    expect(screen.getByText(/allow notifications for HealAll/i)).toBeTruthy();
    expect(toggle().disabled).toBe(true);
  });

  it("can't be switched on while the API has push turned off", async () => {
    stubPermission("default");
    api.getPushPublicKey.mockResolvedValue({ enabled: false, public_key: null });
    render(<NotificationsCard />);

    expect(await screen.findByText("Not available yet")).toBeTruthy();
    expect(toggle().disabled).toBe(true);
  });

  it("explains what gets notified, and never asks for permission on load", async () => {
    const requestPermission = stubPermission("default");
    push.getPushStatus.mockResolvedValue("off");
    render(<NotificationsCard />);

    expect(await screen.findByText("Off")).toBeTruthy();
    expect(screen.getByText(/messages you, comments on your post or offers to help/i)).toBeTruthy();
    expect(screen.getByText(/never shows what they wrote/i)).toBeTruthy();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(push.enablePush).not.toHaveBeenCalled();
  });

  it("turns notifications on from a tap", async () => {
    stubPermission("default");
    push.getPushStatus.mockResolvedValue("off");
    push.enablePush.mockResolvedValue("on");
    render(<NotificationsCard />);
    await screen.findByText("Off");

    fireEvent.click(toggle());

    expect(await screen.findByText("On for this device")).toBeTruthy();
    expect(push.enablePush).toHaveBeenCalledWith("t1", "server-key");
    expect(toggle().checked).toBe(true);
  });

  it("shows blocked when the member says no to the prompt", async () => {
    stubPermission("default");
    push.getPushStatus.mockResolvedValue("off");
    push.enablePush.mockResolvedValue("blocked");
    render(<NotificationsCard />);
    await screen.findByText("Off");

    fireEvent.click(toggle());

    expect(await screen.findByText("Blocked in browser settings")).toBeTruthy();
  });

  it("turns notifications off", async () => {
    stubPermission("granted");
    push.getPushStatus.mockResolvedValue("on");
    push.disablePush.mockResolvedValue("off");
    render(<NotificationsCard />);
    await screen.findByText("On for this device");

    fireEvent.click(toggle());

    expect(await screen.findByText("Off")).toBeTruthy();
    expect(push.disablePush).toHaveBeenCalledWith("t1");
  });

  it("says so when turning on fails, and shows where the device really stands", async () => {
    stubPermission("default");
    push.getPushStatus.mockResolvedValue("off");
    push.enablePush.mockRejectedValue(new Error("offline"));
    render(<NotificationsCard />);
    await screen.findByText("Off");

    fireEvent.click(toggle());

    expect(await screen.findByText(/couldn't turn on notifications/i)).toBeTruthy();
    await waitFor(() => expect(toggle().disabled).toBe(false));
    expect(toggle().checked).toBe(false);
  });
});
