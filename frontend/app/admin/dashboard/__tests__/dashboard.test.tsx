import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { AdminStatsResponse, UserInfo } from "@/lib/types/api";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const api = vi.hoisted(() => ({ getAdminStats: vi.fn() }));
vi.mock("@/lib/api/admin", () => api);

import AdminDashboardPage from "@/app/admin/dashboard/page";

const STATS: AdminStatsResponse = {
  total_users: 1240,
  verified_users: 620,
  suspended_users: 3,
  active_posts: 87,
  open_cases: 12,
  pending_verifications: 4,
  pending_reports: 0,
};

function signIn(roles: string[]) {
  useAuthStore.getState().setSession("t", { id: "me", name: "Asha Rao", roles } as UserInfo);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearSession();
});

describe("AdminDashboardPage", () => {
  it("leads with the queues that need staff, linked to where the work is", async () => {
    signIn(["admin"]);
    api.getAdminStats.mockResolvedValue(STATS);
    render(<AdminDashboardPage />);

    const verify = await screen.findByRole("link", { name: /4 requests to verify/ });
    expect(verify.getAttribute("href")).toBe("/admin/verification");
    const reports = screen.getByRole("link", { name: /No open reports/ });
    expect(reports.getAttribute("href")).toBe("/admin/moderation");

    // Exact Indian-grouped figures, with the verified share.
    expect(screen.getByText("1,240")).toBeTruthy();
    expect(screen.getByText("50% of members")).toBeTruthy();
  });

  it("tells members without the admin role, without asking the API", () => {
    signIn(["moderator"]);
    render(<AdminDashboardPage />);

    expect(screen.getByRole("heading", { name: "For admins only" })).toBeTruthy();
    expect(api.getAdminStats).not.toHaveBeenCalled();
  });

  it("offers a retry when the stats fail to load", async () => {
    signIn(["head_admin"]);
    api.getAdminStats.mockRejectedValueOnce(new ApiError("Service unavailable", 503)).mockResolvedValueOnce(STATS);
    render(<AdminDashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: /4 requests to verify/ })).toBeTruthy();
    expect(api.getAdminStats).toHaveBeenCalledTimes(2);
  });
});
