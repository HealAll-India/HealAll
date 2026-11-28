import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

const users = vi.hoisted(() => ({ updateMyProfile: vi.fn() }));
vi.mock("@/lib/api/users", () => users);

import { AgeConfirmCard } from "@/components/profile/age-confirm-card";

describe("AgeConfirmCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession("t1", { id: "u1", name: "Ravi" } as UserInfo);
  });

  it("offers only adult age ranges and saves the one picked", async () => {
    const updated = { id: "u1", age_range: "25-34" };
    users.updateMyProfile.mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(<AgeConfirmCard onUpdated={onUpdated} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).not.toContain("13-17");
    fireEvent.change(select, { target: { value: "25-34" } });
    fireEvent.click(screen.getByRole("button", { name: /18 or over/i }));

    await waitFor(() => expect(users.updateMyProfile).toHaveBeenCalledWith("t1", { age_range: "25-34" }));
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });
});
