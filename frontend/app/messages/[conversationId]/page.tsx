"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { getConversation, sendMessage } from "@/lib/api/messages";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationDetailResponse, MessageResponse } from "@/lib/types/api";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isSameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface BubbleProps {
  msg: MessageResponse;
  isMine: boolean;
}

function Bubble({ msg, isMine }: BubbleProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
        marginBottom: "8px",
      }}
    >
      <div
        style={{
          maxWidth: "72%",
          background: isMine ? "#16a34a" : "#f3f4f6",
          color: isMine ? "#fff" : "#111827",
          borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "10px 14px",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, wordBreak: "break-word" }}>
          {msg.body}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "10px",
            color: isMine ? "rgba(255,255,255,0.7)" : "#9ca3af",
            textAlign: isMine ? "right" : "left",
          }}
        >
          {formatTime(msg.created_at)}
          {msg.read_at && isMine ? " · Read" : ""}
        </p>
      </div>
    </div>
  );
}

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const myId = useAuthStore((s) => s.user?.id ?? "");

  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getConversation(token, conversationId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load conversation"))
      .finally(() => setLoading(false));
  }, [token, conversationId]);

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !body.trim() || sending) return;

    setSending(true);
    setError(null);
    const text = body.trim();
    setBody("");

    try {
      const message = await sendMessage(token, conversationId, text);
      setDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, message] } : prev
      );
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
      setBody(text); // restore text on failure
    } finally {
      setSending(false);
    }
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  const otherId = detail
    ? detail.conversation.user_a === myId
      ? detail.conversation.user_b
      : detail.conversation.user_a
    : null;

  return (
    <main className="page" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", padding: 0 }}>
      {/* Header */}
      <div
        className="card"
        style={{
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none",
          borderTop: "none",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <Link href="/messages" style={{ color: "#16a34a", fontSize: "18px", lineHeight: 1 }}>
          ←
        </Link>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
          }}
        >
          💬
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "14px" }}>
            {otherId ? `User ${otherId.slice(0, 8)}…` : "Conversation"}
          </p>
          {loading && (
            <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>Loading…</p>
          )}
        </div>
      </div>

      {/* Message area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {error && <p className="error">{error}</p>}

        {!loading && detail && detail.messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: "40px" }}>
            <p style={{ fontSize: "28px", margin: 0 }}>👋</p>
            <p className="muted" style={{ fontSize: "13px", marginTop: "8px" }}>
              No messages yet — say hello!
            </p>
          </div>
        )}

        {detail?.messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} isMine={msg.sender_id === myId} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="card"
        style={{
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        {detail?.conversation.ended_at ? (
          <p className="muted" style={{ textAlign: "center", margin: 0, fontSize: "13px" }}>
            This conversation has ended.
          </p>
        ) : (
          <form
            onSubmit={handleSend}
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <input
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
              style={{ flex: 1 }}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              style={{ flexShrink: 0, padding: "0 18px" }}
            >
              {sending ? "…" : "Send"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
