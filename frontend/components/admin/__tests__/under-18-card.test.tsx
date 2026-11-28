import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

const api = vi.hoisted(() => ({
  getAdminStats: vi.fn(),
  getUnder18Summary: vi.fn(),
  warnUnder18: vi.fn(),
  closeUnder18: vi.fn(),
}));
vi.mock("@/lib/api/admin", () => api);

import { Under18Card } from "@/components/admin/under-18-card";

const HEAD = { id: "u1", name: "Anu" } as UserInfo;
const SUMMARY = { total: 3, not_warned: 2, waiting: 1, due: 0, staff: 0, next_close_on: "2026-12-06" };

describe("Under18Card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession("t1", HEAD);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("says there is nothing to do when no accounts say 13 to 17", async () => {
    api.getUnder18Summary.mockResolvedValue({ ...SUMMARY, total: 0, not_warned: 0, waiting: 0, next_close_on: null });
    render(<Under18Card />);
    expect(await screen.findByText(/nothing to do/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the counts and keeps Close disabled until accounts are due", async () => {
    api.getUnder18Summary.mockResolvedValue(SUMMARY);
    render(<Under18Card />);
    expect(await screen.findByText(/3 account\(s\) say 13 to 17/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /close accounts/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends nothing when the confirm is cancelled", async () => {
    api.getUnder18Summary.mockResolvedValue(SUMMARY);
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<Under18Card />);
    fireEvent.click(await screen.findByRole("button", { name: /send warnings/i }));
    expect(api.warnUnder18).not.toHaveBeenCalled();
  });

  it("sends warnings after confirming and reports the closing day", async () => {
    api.getUnder18Summary.mockResolvedValue(SUMMARY);
    api.warnUnder18.mockResolvedValue({ sent: 2, failed: 0, close_on: "2026-12-06" });
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<Under18Card />);
    fireEvent.click(await screen.findByRole("button", { name: /send warnings/i }));
    await waitFor(() => expect(api.warnUnder18).toHaveBeenCalledWith("t1"));
    expect(await screen.findByText(/Sent 2 warning\(s\)/)).toBeTruthy();
  });
});
