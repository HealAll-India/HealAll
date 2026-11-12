import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { ModerationActionResponse, ReportResponse, UserInfo } from "@/lib/types/api";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const api = vi.hoisted(() => ({
  createModerationAction: vi.fn(),
  getTriageConfig: vi.fn(),
  listModerationActions: vi.fn(),
  listReports: vi.fn(),
}));
vi.mock("@/lib/api/moderation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/moderation")>()),
  ...api,
}));

import ModerationAdminPage from "@/app/admin/moderation/page";

const HOUR = 3_600_000;

function report(overrides: Partial<ReportResponse> = {}): ReportResponse {
  return {
    id: "r1",
    reporter_id: "11111111-aaaa-bbbb-cccc-000000000000",
    target_type: "post",
    target_id: "p1",
    reason: "fraud",
    description: "Asked me to pay a deposit first.",
    status: "pending",
    created_at: new Date(Date.now() - 2 * HOUR).toISOString(),
    ...overrides,
  };
}

function action(overrides: Partial<ModerationActionResponse> = {}): ModerationActionResponse {
  return {
    id: "a1",
    report_id: "r0",
    target_user_id: "u9",
    acted_by: "me",
    action: "suspend",
    reason: "Repeated spam",
    duration_hours: 48,
    expires_at: new Date(Date.now() + 47 * HOUR).toISOString(),
    created_at: new Date(Date.now() - HOUR).toISOString(),
    ...overrides,
  };
}

function page<T>(items: T[]) {
  return { items, page: 1, per_page: 30, total: items.length, has_next: false };
}

function signIn(roles: string[]) {
  useAuthStore.getState().setSession("t", { id: "me", name: "Asha Rao", roles } as UserInfo);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearSession();
  api.getTriageConfig.mockResolvedValue({ enabled: false });
  api.listModerationActions.mockResolvedValue(page([action()]));
});

describe("ModerationAdminPage", () => {
  it("shows why something was reported, the reporter's note and a way to the post", async () => {
    signIn(["moderator"]);
    api.listReports.mockResolvedValue(page([report()]));
    render(<ModerationAdminPage />);

    const card = await screen.findByRole("article", { name: "Reported post" });
    expect(within(card).getByText("Fraud")).toBeTruthy();
    expect(within(card).getByText("Asked me to pay a deposit first.")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Open post" }).getAttribute("href")).toBe("/posts/p1");
    expect(within(card).getByText("11111111")).toBeTruthy();
  });

  it("says when a time-limited action ends instead of “expires just now”", async () => {
    signIn(["admin"]);
    api.listReports.mockResolvedValue(page([]));
    render(<ModerationAdminPage />);

    const history = await screen.findByRole("list");
    const row = within(history).getByText("Repeated spam").closest("li") as HTMLElement;
    expect(row.textContent).toContain("Suspended");
    expect(row.textContent).toMatch(/For 2 days, until \d/);
    expect(row.textContent).not.toContain("just now");
  });

  it("filters by status, and the filter chips carry no count from another status", async () => {
    signIn(["moderator"]);
    api.listReports.mockResolvedValue(page([]));
    render(<ModerationAdminPage />);

    expect(await screen.findByRole("heading", { name: "No pending reports" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resolved" }));

    expect(await screen.findByRole("heading", { name: "No resolved reports" })).toBeTruthy();
    expect(api.listReports).toHaveBeenLastCalledWith("t", "resolved", 1, 30);
    expect(screen.getByRole("button", { name: "Pending" }).textContent).toBe("Pending");
    expect(screen.getByRole("button", { name: "Resolved" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("takes an acted-on report out of the pending list and confirms it", async () => {
    signIn(["moderator"]);
    api.listReports.mockResolvedValueOnce(page([report()])).mockResolvedValue(page([]));
    api.createModerationAction.mockResolvedValue(action({ action: "warn" }));
    render(<ModerationAdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: /take action/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Warning sent.")).toBeTruthy();
    expect(screen.queryByRole("article", { name: "Reported post" })).toBeNull();
    expect(api.createModerationAction).toHaveBeenCalledWith(
      "t",
      expect.objectContaining({ report_id: "r1", target_user_id: undefined, action: "warn" }),
    );
  });

  it("tells members without a moderation role, without asking the API", () => {
    signIn(["case_verifier"]);
    render(<ModerationAdminPage />);

    expect(screen.getByRole("heading", { name: "For moderators only" })).toBeTruthy();
    expect(api.listReports).not.toHaveBeenCalled();
    expect(api.getTriageConfig).not.toHaveBeenCalled();
  });
});
