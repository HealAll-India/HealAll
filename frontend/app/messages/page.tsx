"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { acceptConsent, declineConsent, listConversations } from "@/lib/api/messages";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationResponse } from "@/lib/types/api";

export default function MessagesPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadConversations() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await listConversations(token);
      setConversations(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAcceptConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !requestId.trim()) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const conversation = await acceptConsent(token, requestId);
      setMessage(`Consent accepted. Conversation: ${conversation.id}`);
      setRequestId("");
      await loadConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept consent");
    }
  }

  async function handleDeclineConsent() {
    if (!token || !requestId.trim()) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await declineConsent(token, requestId);
      setMessage("Consent request declined.");
      setRequestId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to decline consent");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <section className="card stack">
            <h1>Messages (Module 5)</h1>
            <p className="muted">Consent-gated conversations.</p>
          </section>

          <section className="card stack">
            <h3>Accept/Decline Consent Request</h3>
            <form className="row" onSubmit={handleAcceptConsent}>
              <input
                placeholder="Consent request UUID"
                value={requestId}
                onChange={(event) => setRequestId(event.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit">Accept</button>
              <button className="danger" onClick={handleDeclineConsent} type="button">
                Decline
              </button>
            </form>
          </section>

          {loading ? <p className="muted">Loading...</p> : null}
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <section className="grid">
            {conversations.map((conversation) => (
              <article className="card stack" key={conversation.id}>
                <p style={{ margin: 0 }}>
                  Conversation: <strong>{conversation.id}</strong>
                </p>
                <p className="muted">
                  users: {conversation.user_a} / {conversation.user_b}
                </p>
                <Link href={`/messages/${conversation.id}`}>
                  <button className="ghost" type="button">
                    Open Thread
                  </button>
                </Link>
              </article>
            ))}
            {!loading && conversations.length === 0 ? (
              <section className="card">
                <p className="muted">No conversations yet.</p>
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
