import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, UNREACHABLE_MESSAGE } from "@/lib/api/client";
import type { UserInfo } from "@/lib/types/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@react-oauth/google", () => ({ GoogleLogin: () => null }));

const auth = vi.hoisted(() => ({
  resendOtp: vi.fn(),
  login: vi.fn(),
  getGoogleNonce: vi.fn(),
  googleLogin: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => auth);

import LoginPage from "@/app/login/page";

const USER = { id: "u1", name: "Priya Sharma" } as UserInfo;

beforeEach(() => {
  vi.clearAllMocks();
  auth.getGoogleNonce.mockResolvedValue({ nonce: "n" });
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function typeIdentifier(value: string) {
  fireEvent.change(screen.getByLabelText(/mobile number or email/i), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /send code/i }));
}

describe("LoginPage", () => {
  it("asks for the number first, then the code, and signs in", async () => {
    auth.resendOtp.mockResolvedValue({ message: "sent" });
    auth.login.mockResolvedValue({ access_token: "t", token_type: "bearer", expires_in: 900, user: USER });
    render(<LoginPage />);

    typeIdentifier("98765 43210");
    expect(await screen.findByText(/we sent a 6-digit code to/i)).toBeTruthy();
    expect(auth.resendOtp).toHaveBeenCalledWith({ phone_or_email: "98765 43210" });

    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: "12 34 56" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/feed"));
    expect(auth.login).toHaveBeenCalledWith({ phone_or_email: "98765 43210", otp_code: "123456" });
  });

  it("checks the identifier before calling the API", () => {
    render(<LoginPage />);
    typeIdentifier("12345");
    expect(screen.getByRole("alert").textContent).toMatch(/10-digit mobile number/i);
    expect(auth.resendOtp).not.toHaveBeenCalled();
  });

  it("explains an unknown account instead of 'User not found'", async () => {
    auth.resendOtp.mockResolvedValue({ message: "sent" });
    auth.login.mockRejectedValue(new ApiError("User not found", 404));
    render(<LoginPage />);

    typeIdentifier("priya@example.com");
    fireEvent.change(await screen.findByLabelText(/6-digit code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/no healall account uses priya@example.com/i);
  });

  it("says plainly when HealAll can't be reached", async () => {
    auth.resendOtp.mockRejectedValue(new ApiError(UNREACHABLE_MESSAGE, 0, "NETWORK_ERROR"));
    render(<LoginPage />);

    typeIdentifier("98765 43210");
    expect((await screen.findByRole("alert")).textContent).toBe(UNREACHABLE_MESSAGE);
    expect(screen.getByLabelText(/mobile number or email/i)).toBeTruthy();
  });

  it("lets the member change the number", async () => {
    auth.resendOtp.mockResolvedValue({ message: "sent" });
    render(<LoginPage />);

    typeIdentifier("98765 43210");
    fireEvent.click(await screen.findByRole("button", { name: /change/i }));
    expect(screen.getByLabelText(/mobile number or email/i)).toBeTruthy();
    expect(screen.queryByLabelText(/6-digit code/i)).toBeNull();
  });
});
