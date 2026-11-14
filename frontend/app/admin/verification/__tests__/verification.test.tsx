import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo, VerificationQueueItem } from "@/lib/types/api";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const api = vi.hoisted(() => ({
  getVerificationQueue: vi.fn(),
  verifyPost: vi.fn(),
  requestInfo: vi.fn(),
  rejectPost: vi.fn(),
}));
vi.mock("@/lib/api/verification", () => api);

import VerificationAdminPage from "@/app/admin/verification/page";

const ITEM: VerificationQueueItem = {
  post_id: "p1",
  title: "Need O+ blood for my father",
  description: "Surgery at KEM Hospital on Friday. Two units needed.",
  category: "urgent",
  urgency: "critical",
  city: "Pune",
  author: { id: "u1", name: "Ravi Kumar", verification_level: 1 },
  submitted_at: new Date().toISOString(),
};

function queue(items: VerificationQueueItem[], total = items.length) {
  return { items, page: 1, per_page: 30, total, has_next: total > items.length };
}

function signIn(roles: string[]) {
  useAuthStore.getState().setSession("t", { id: "me", name: "Asha Rao", roles } as UserInfo);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearSession();
});

describe("VerificationAdminPage", () => {
  it("shows the full request, since verifiers can't open a post before it's live", async () => {
    signIn(["case_verifier"]);
    api.getVerificationQueue.mockResolvedValue(queue([ITEM]));
    render(<VerificationAdminPage />);

    const card = await screen.findByRole("article", { name: ITEM.title });
    expect(within(card).getByText(ITEM.description as string)).toBeTruthy();
    expect(within(card).getByText("Pune")).toBeTruthy();
    // The old title link pointed at /posts/p1, which returns 404 for a submitted post.
    expect(within(card).queryByRole("link")).toBeNull();
  });

  it("holds every decision until the note meets the API's 5-character minimum, then sends it trimmed", async () => {
    signIn(["admin"]);
    api.getVerificationQueue.mockResolvedValueOnce(queue([ITEM])).mockResolvedValue(queue([]));
    api.verifyPost.mockResolvedValue({});
    render(<VerificationAdminPage />);

    const note = await screen.findByLabelText("Note for the record");
    const verify = screen.getByRole("button", { name: "Verify" });
    fireEvent.change(note, { target: { value: "  ok  " } });
    expect((verify as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(note, { target: { value: "  Called the hospital  " } });
    fireEvent.click(verify);

    expect(await screen.findByText(/Verified\. The request is live/)).toBeTruthy();
    expect(api.verifyPost).toHaveBeenCalledWith("t", "p1", "Called the hospital");
    expect(screen.queryByRole("article", { name: ITEM.title })).toBeNull();
  });

  it("counts the whole queue, not just the page on screen", async () => {
    signIn(["case_verifier"]);
    api.getVerificationQueue.mockResolvedValue(queue([ITEM], 42));
    render(<VerificationAdminPage />);

    expect(await screen.findByText("42 requests waiting, oldest first.")).toBeTruthy();
    expect(screen.getByText(/Showing the oldest 1\./)).toBeTruthy();
  });

  it("turns decisions off when the request text is missing, so nobody approves unread", async () => {
    signIn(["case_verifier"]);
    api.getVerificationQueue.mockResolvedValue(queue([{ ...ITEM, description: undefined }]));
    render(<VerificationAdminPage />);

    const card = await screen.findByRole("article", { name: ITEM.title });
    expect(within(card).getByText(/decisions are off for this one/)).toBeTruthy();
    fireEvent.change(within(card).getByLabelText("Note for the record"), { target: { value: "Looks fine" } });
    for (const name of ["Verify", "Ask for more info", "Reject"]) {
      expect((within(card).getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("drops an old load error once a later request succeeds", async () => {
    signIn(["case_verifier"]);
    api.getVerificationQueue.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(queue([ITEM]));
    render(<VerificationAdminPage />);
    expect(await screen.findByText("We couldn't load the queue.")).toBeTruthy();

    // A renewed session token starts a fresh request without "Try again".
    act(() => {
      useAuthStore.getState().setSession("t2", { id: "me", name: "Asha Rao", roles: ["case_verifier"] } as UserInfo);
    });

    expect(await screen.findByRole("article", { name: ITEM.title })).toBeTruthy();
    expect(screen.queryByText("We couldn't load the queue.")).toBeNull();
  });

  it("lets Refresh start over while the first load hangs", async () => {
    signIn(["case_verifier"]);
    api.getVerificationQueue.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(queue([ITEM]));
    render(<VerificationAdminPage />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByRole("article", { name: ITEM.title })).toBeTruthy();
    expect(api.getVerificationQueue).toHaveBeenCalledTimes(2);
  });

  it("tells members without the verifier role, without asking the API", () => {
    signIn(["moderator"]);
    render(<VerificationAdminPage />);

    expect(screen.getByRole("heading", { name: "For verifiers only" })).toBeTruthy();
    expect(api.getVerificationQueue).not.toHaveBeenCalled();
  });
});
