"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { listConversations } from "@/lib/api/messages";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationResponse } from "@/lib/types/api";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncateId(id: string): string {
  return id.slice(0, 8) + "…";
}

interface ConvCardProps {
  conv: ConversationResponse;
  myId: string;
}

function ConvCard({ conv, myId }: ConvCardProps) {
  const otherId = conv.user_a === myId ? conv.user_b : conv.user_a;

  return (
    <Link href={`/messages/${conv.id}`} style={{ textDecoration: "none" }}>
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "14px 18px",
          cursor: "pointer",
          transition: "box-shadow 0.15s",
        }}
      >
        {/* Avatar placeholder */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          💬
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "#111827" }}>
            User {truncateId(otherId)}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
            {conv.ended_at ? "Conversation ended" : "Tap to open thread"}
          </p>
        </div>

        <span style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0 }}>
          {timeAgo(conv.created_at)}
        </span>
      </div>
    </Link>
  );
}

export default function MessagesPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const myId = useAuthStore((s) => s.user?.id ?? "");

  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listConversations(token)
      .then(setConversations)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load conversations"))
      .finally(() => setLoading(false));
  }, [token]);

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  return (
    <main className="page">
      <section className="card stack" style={{ marginBottom: "16px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>Messages</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
              Your consent-gated conversations
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="card">
          <p className="muted">Loading conversations…</p>
        </section>
      ) : error ? (
        <section className="card">
          <p className="error">{error}</p>
        </section>
      ) : conversations.length === 0 ? (
        <section className="card stack" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p style={{ fontSize: "32px", margin: 0 }}>💬</p>
          <p style={{ fontWeight: 600, margin: "8px 0 4px" }}>No conversations yet</p>
          <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
            When someone accepts a consent request, your conversation will appear here.
          </p>
        </section>
      ) : (
        <div className="stack" style={{ gap: "8px" }}>
          {conversations.map((conv) => (
            <ConvCard key={conv.id} conv={conv} myId={myId} />
          ))}
        </div>
      )}
    </main>
  );
}
