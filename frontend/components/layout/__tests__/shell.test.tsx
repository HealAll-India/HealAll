import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountMenu } from "@/components/layout/account-menu";
import { isActive, isTabBarHidden, roleLinks } from "@/components/layout/nav-config";
import type { UserInfo } from "@/lib/types/api";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function user(roles: UserInfo["roles"], level = 1): UserInfo {
  return {
    id: "u1", name: "Priya Sharma", email: "p@example.com", phone: "+919999999999",
    city: "New Delhi, Delhi", age_range: "25-34", roles, verification_level: level, avatar_url: null,
  } as UserInfo;
}

describe("nav-config", () => {
  it("gates staff links by role", () => {
    expect(roleLinks(["help_seeker"])).toEqual([]);
    expect(roleLinks(["moderator"]).map((l) => l.label)).toEqual(["Moderation"]);
    expect(roleLinks(["case_verifier"]).map((l) => l.label)).toEqual(["Verification queue"]);
    expect(roleLinks(["admin"]).map((l) => l.label)).toEqual([
      "Moderation", "Verification queue", "Invites", "Dashboard",
    ]);
  });

  it("hides the tab bar only on full-screen flows", () => {
    expect(isTabBarHidden("/posts/new")).toBe(true);
    expect(isTabBarHidden("/messages/abc-123")).toBe(true);
    expect(isTabBarHidden("/messages")).toBe(false);
    expect(isTabBarHidden("/feed")).toBe(false);
    expect(isTabBarHidden("/posts/abc-123")).toBe(false);
  });

  it("treats request detail pages as part of the feed, but not the new-request flow", () => {
    expect(isActive("/posts/abc", "/feed")).toBe(true);
    expect(isActive("/posts/new", "/feed")).toBe(false);
    expect(isActive("/messages/abc", "/messages")).toBe(true);
    expect(isActive("/verify", "/verify")).toBe(true);
    expect(isActive("/verify-otp", "/verify")).toBe(false);
  });
});

describe("AccountMenu", () => {
  it("shows only the staff tools a member's roles allow", () => {
    render(<AccountMenu user={user(["help_seeker", "helper"])} onSignOut={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menuitem", { name: /profile/i })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /moderation/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /invites/i })).toBeNull();
  });

  it("supports arrow keys, closes on Escape and returns focus to the trigger", () => {
    render(<AccountMenu user={user(["admin"], 2)} onSignOut={() => {}} />);
    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document, { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("signs out from the menu", () => {
    const onSignOut = vi.fn();
    render(<AccountMenu user={user(["helper"])} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("useVerifyCount", () => {
  it("never shows another account's count after the token changes", async () => {
    const { renderHook, waitFor } = await import("@testing-library/react");
    const api = await import("@/lib/api/community-verification");
    const spy = vi.spyOn(api, "getCommunityQueue")
      .mockResolvedValueOnce({ total: 7 } as Awaited<ReturnType<typeof api.getCommunityQueue>>)
      .mockImplementationOnce(() => new Promise(() => {})); // second account: still loading
    const { useVerifyCount } = await import("@/components/layout/use-verify-count");
    const { result, rerender } = renderHook(
      ({ token }) => useVerifyCount(token, 1, "/feed"),
      { initialProps: { token: "token-a" as string | null } },
    );
    await waitFor(() => expect(result.current).toBe(7));
    rerender({ token: "token-b" });
    expect(result.current).toBeNull();
    spy.mockRestore();
  });
});

describe("AccountMenu arrow keys from the trigger", () => {
  it("ArrowUp from outside the items lands on the last item", () => {
    render(<AccountMenu user={user(["helper"])} onSignOut={() => {}} />);
    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);
    trigger.focus();
    fireEvent.keyDown(document, { key: "ArrowUp" });
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[items.length - 1]);
  });
});

describe("TabBar badges", () => {
  it("says what each count means to screen readers", async () => {
    const { TabBar } = await import("@/components/layout/tab-bar");
    render(<TabBar pathname="/feed" badges={{ verify: 3, messages: 2 }} />);
    // Exact names: the visible count is aria-hidden, so it's announced once.
    expect(screen.getByRole("link", { name: "Verify, 3 waiting for your vote" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Messages, 2 new message requests" })).toBeTruthy();
  });
});
