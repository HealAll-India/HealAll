"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { getConversation, sendMessage } from "@/lib/api/messages";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationDetailResponse } from "@/lib/types/api";

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadConversation() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getConversation(token, conversationId);
      setDetail(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, conversationId]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !body.trim()) {
      return;
    }

    setError(null);

    try {
      const message = await sendMessage(token, conversationId, body.trim());
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, message]
            }
          : prev
      );
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <section className="card stack">
            <h1>Conversation (Module 5)</h1>
            {loading ? <p className="muted">Loading...</p> : null}
            <p className="muted">Conversation ID: {conversationId}</p>
          </section>

          <section className="card stack">
            <form className="row" onSubmit={handleSendMessage}>
              <input
                placeholder="Type a message"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit">Send</button>
            </form>
          </section>

          {error ? <p className="error">{error}</p> : null}

          <section className="stack">
            {detail?.messages.map((message) => (
              <article className="card" key={message.id}>
                <p style={{ marginTop: 0 }}>{message.body}</p>
                <p className="muted">
                  sender: {message.sender_id} · {message.created_at}
                </p>
              </article>
            ))}
            {!loading && detail && detail.messages.length === 0 ? (
              <section className="card">
                <p className="muted">No messages yet.</p>
              </section>
            ) : null}
          </section>
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
