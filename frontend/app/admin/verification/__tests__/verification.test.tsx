import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("tells members without the verifier role, without asking the API", () => {
    signIn(["moderator"]);
    render(<VerificationAdminPage />);

    expect(screen.getByRole("heading", { name: "For verifiers only" })).toBeTruthy();
    expect(api.getVerificationQueue).not.toHaveBeenCalled();
  });
});
