import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationResponse, UserInfo } from "@/lib/types/api";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const api = vi.hoisted(() => ({ listConversations: vi.fn() }));
vi.mock("@/lib/api/messages", () => api);

import MessagesPage from "@/app/messages/page";

const ME = { id: "me", name: "Priya Sharma" } as UserInfo;

function conversation(overrides: Partial<ConversationResponse>): ConversationResponse {
  return {
    id: "c1",
    consent_id: "k1",
    user_a: "me",
    user_b: "them",
    ended_at: null,
    created_at: new Date().toISOString(),
    other_member: { id: "them", name: "Arjun Rao", avatar_url: null },
    last_message: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearSession();
  useAuthStore.getState().setSession("t", ME);
});

describe("MessagesPage", () => {
  it("names who each conversation is with and previews the latest message", async () => {
    api.listConversations.mockResolvedValue([
      conversation({
        id: "c1",
        last_message: { body: "See you at 5", sender_id: "them", created_at: new Date().toISOString() },
      }),
      conversation({
        id: "c2",
        other_member: { id: "x", name: "Meera Iyer", avatar_url: null },
        last_message: { body: "Thanks!", sender_id: "me", created_at: new Date().toISOString() },
      }),
    ]);
    render(<MessagesPage />);

    const list = await screen.findByRole("list", { name: "Conversations" });
    const [first, second] = within(list).getAllByRole("link");
    expect(first.getAttribute("href")).toBe("/messages/c1");
    expect(first.textContent).toContain("Arjun Rao");
    expect(first.textContent).toContain("See you at 5");
    expect(second.textContent).toContain("Meera Iyer");
    expect(second.textContent).toContain("You: Thanks!");
    // The old list showed a cut-off id instead of a name.
    expect(list.textContent).not.toMatch(/User [0-9a-f]/);
  });

  it("invites a first hello when a conversation has no messages", async () => {
    api.listConversations.mockResolvedValue([conversation({})]);
    render(<MessagesPage />);
    expect(await screen.findByText(/no messages yet/i)).toBeTruthy();
  });

  it("explains what will appear when there are no conversations", async () => {
    api.listConversations.mockResolvedValue([]);
    render(<MessagesPage />);
    expect(await screen.findByRole("heading", { name: /no conversations yet/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /browse open requests/i }).getAttribute("href")).toBe("/feed");
  });

  it("offers to try again when loading fails", async () => {
    api.listConversations
      .mockRejectedValueOnce(new ApiError("HealAll is temporarily unavailable.", 503))
      .mockResolvedValueOnce([conversation({})]);
    render(<MessagesPage />);

    expect((await screen.findByRole("alert")).textContent).toContain("temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("list", { name: "Conversations" })).toBeTruthy();
    expect(api.listConversations).toHaveBeenCalledTimes(2);
  });
});
