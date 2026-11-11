import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { MyUserProfile, UserInfo } from "@/lib/types/api";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/ui/india-location-picker", () => ({ IndiaLocationPicker: () => null }));
vi.mock("@/components/ui/auth-required", () => ({ AuthRequired: () => <p>Sign in</p> }));
vi.mock("@/lib/api/uploads", () => ({ presignProfilePhoto: vi.fn(), putToPresignedUrl: vi.fn() }));

const users = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  updatePrivacy: vi.fn(),
  addSkill: vi.fn(),
}));
vi.mock("@/lib/api/users", () => users);

import ProfilePage from "@/app/profile/page";

const PRIYA = { id: "u1", name: "Priya Sharma" } as UserInfo;
const ARJUN = { id: "u2", name: "Arjun Rao" } as UserInfo;

function profileOf(user: UserInfo): MyUserProfile {
  return {
    id: user.id,
    name: user.name,
    email: "member@example.com",
    phone: "+919876543210",
    city: "Delhi, Delhi",
    age_range: "25-34",
    bio: null,
    avatar_url: null,
    roles: ["helper"],
    verification_level: 1,
    phone_verified: true,
    email_verified: true,
    is_active: true,
    skills: [],
    privacy_settings: { show_email: false, show_phone: false, show_full_city: false },
  } as MyUserProfile;
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    users.getMyProfile.mockImplementation(async () => profileOf(useAuthStore.getState().user ?? PRIYA));
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession("t1", PRIYA);
  });

  it("keeps unsaved edits when the access token is renewed", async () => {
    render(<ProfilePage />);
    const name = (await screen.findByLabelText(/^name$/i)) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Priya S." } });

    // What the API client does when it renews the 15-minute access token.
    act(() => useAuthStore.getState().updateSession(PRIYA, "t2"));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe("t2"));
    expect(users.getMyProfile).toHaveBeenCalledOnce();
    expect(name.value).toBe("Priya S.");
  });

  it("loads the new member's profile when someone else signs in", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Priya Sharma");

    act(() => useAuthStore.getState().setSession("t9", ARJUN));

    expect(await screen.findByDisplayValue("Arjun Rao")).toBeTruthy();
    expect(users.getMyProfile).toHaveBeenLastCalledWith("t9");
  });
});
