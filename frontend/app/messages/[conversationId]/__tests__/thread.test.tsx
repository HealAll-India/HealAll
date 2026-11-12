import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationDetailResponse, MessageResponse, UserInfo } from "@/lib/types/api";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ conversationId: "c1" }) }));

const api = vi.hoisted(() => ({ getConversation: vi.fn(), sendMessage: vi.fn() }));
vi.mock("@/lib/api/messages", () => api);

import ConversationPage from "@/app/messages/[conversationId]/page";

const ME = { id: "me", name: "Priya Sharma" } as UserInfo;

function message(id: string, body: string, sender = "them"): MessageResponse {
  return { id, conversation_id: "c1", sender_id: sender, body, read_at: null, created_at: new Date().toISOString() };
}

function detail(messages: MessageResponse[], extra: Partial<ConversationDetailResponse> = {}): ConversationDetailResponse {
  return {
    conversation: {
      id: "c1",
      consent_id: "k1",
      user_a: "me",
      user_b: "them",
      ended_at: null,
      created_at: new Date().toISOString(),
      other_member: { id: "them", name: "Arjun Rao", avatar_url: null },
    },
    messages,
    has_more: false,
    ...extra,
  };
}

const bodies = () =>
  within(screen.getByRole("list")).queryAllByRole("listitem").map((li) => li.textContent ?? "");

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearSession();
  useAuthStore.getState().setSession("t", ME);
});

describe("ConversationPage", () => {
  it("shows who the conversation is with and who sent each message", async () => {
    api.getConversation.mockResolvedValue(detail([message("m1", "Can you help?"), message("m2", "Yes, happy to", "me")]));
    render(<ConversationPage />);

    expect(await screen.findByRole("heading", { name: "Arjun Rao" })).toBeTruthy();
    const items = bodies().filter((t) => !/^(Today|Yesterday)$/.test(t));
    expect(items[0]).toContain("Arjun Rao: Can you help?");
    expect(items[1]).toContain("You: Yes, happy to");
    expect(api.getConversation).toHaveBeenCalledWith("t", "c1", 1, 50);
  });

  it("loads earlier messages above the ones already shown", async () => {
    api.getConversation
      .mockResolvedValueOnce(detail([message("m3", "Third"), message("m4", "Fourth")], { has_more: true }))
      .mockResolvedValueOnce(detail([message("m1", "First"), message("m2", "Second"), message("m3", "Third")]));
    render(<ConversationPage />);

    fireEvent.click(await screen.findByRole("button", { name: /load earlier messages/i }));
    await waitFor(() => expect(bodies().join(" ")).toContain("First"));
    const texts = bodies().filter((t) => !/^(Today|Yesterday)$/.test(t));
    // Page 2 overlapped page 1 by one message (a send shifts the pages); it isn't shown twice.
    expect(texts.map((t) => t.replace(/^.*?: /, "").replace(/\d.*$/, "").trim())).toEqual([
      "First",
      "Second",
      "Third",
      "Fourth",
    ]);
    expect(api.getConversation).toHaveBeenLastCalledWith("t", "c1", 2, 50);
    expect(screen.queryByRole("button", { name: /load earlier messages/i })).toBeNull();
  });

  it("sends a message and adds it to the thread", async () => {
    api.getConversation.mockResolvedValue(detail([]));
    api.sendMessage.mockResolvedValue(message("m9", "On my way", "me"));
    render(<ConversationPage />);

    const input = (await screen.findByLabelText(/message arjun rao/i)) as HTMLInputElement;
    expect(screen.getByText(/say hello to arjun rao/i)).toBeTruthy();
    fireEvent.change(input, { target: { value: "  On my way " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(bodies().join(" ")).toContain("You: On my way"));
    expect(api.sendMessage).toHaveBeenCalledWith("t", "c1", "On my way");
    expect(input.value).toBe("");
  });

  it("keeps the text when sending fails", async () => {
    api.getConversation.mockResolvedValue(detail([]));
    api.sendMessage.mockRejectedValue(new ApiError("Rate limit exceeded", 429));
    render(<ConversationPage />);

    const input = (await screen.findByLabelText(/message arjun rao/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Rate limit exceeded");
    expect(input.value).toBe("Hello");
  });

  it("lets the member read an ended conversation but not write in it", async () => {
    const ended = detail([message("m1", "Take care")]);
    ended.conversation.ended_at = new Date().toISOString();
    api.getConversation.mockResolvedValue(ended);
    render(<ConversationPage />);

    expect(await screen.findByText(/this conversation has ended/i)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(bodies().join(" ")).toContain("Take care");
  });
});
