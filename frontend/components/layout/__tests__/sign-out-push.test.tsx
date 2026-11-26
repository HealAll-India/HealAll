import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/feed", useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/layout/use-verify-count", () => ({ useVerifyCount: () => null }));

const auth = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock("@/lib/api/auth", () => auth);

const webPush = vi.hoisted(() => ({ unsubscribeThisDevice: vi.fn() }));
vi.mock("@/lib/push/web-push", () => webPush);

import { AppShell } from "@/components/layout/app-shell";

const PRIYA = {
  id: "u1",
  name: "Priya Sharma",
  email: "p@example.com",
  roles: ["helper"],
  verification_level: 1,
  avatar_url: null,
} as unknown as UserInfo;

describe("signing out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.logout.mockResolvedValue({ message: "ok" });
    webPush.unsubscribeThisDevice.mockResolvedValue(undefined);
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession("t1", PRIYA);
  });

  async function signOut() {
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
  }

  it("unsubscribes this device with the member's token before the session ends", async () => {
    let tokenWhileUnsubscribing: string | null = null;
    webPush.unsubscribeThisDevice.mockImplementation(async () => {
      tokenWhileUnsubscribing = useAuthStore.getState().accessToken;
    });

    await signOut();

    expect(webPush.unsubscribeThisDevice).toHaveBeenCalledWith("t1");
    expect(tokenWhileUnsubscribing).toBe("t1");
    expect(webPush.unsubscribeThisDevice.mock.invocationCallOrder[0]).toBeLessThan(
      auth.logout.mock.invocationCallOrder[0],
    );
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("unsubscribes locally when the session expires", async () => {
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    await screen.findByRole("button", { name: /account menu/i });

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    });

    expect(webPush.unsubscribeThisDevice).toHaveBeenCalledWith(null);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
