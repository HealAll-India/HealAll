"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, MessageCircle } from "lucide-react";

import { ConversationRow } from "@/components/messages/conversation-row";
import { AuthRequired } from "@/components/ui/auth-required";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listConversations } from "@/lib/api/messages";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationResponse } from "@/lib/types/api";

export default function MessagesPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const myId = useAuthStore((s) => s.user?.id ?? "");

  // null while loading; the API's list (most recent activity first) once loaded.
  const [conversations, setConversations] = useState<ConversationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(() => {
    if (!token) return;
    listConversations(token)
      .then(setConversations)
      .catch((err) => setError(err instanceof ApiError ? err.message : "We couldn't load your conversations."));
  }, [token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  function retry() {
    setError(null);
    setConversations(null);
    fetchConversations();
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  return (
    <main className="page messages-page">
      <PageHeader title="Messages" subtitle="Private conversations, opened only when both of you agree." />

      {error ? (
        <div className="notice notice--error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{error}</p>
          <button type="button" className="ghost" onClick={retry}>
            Try again
          </button>
        </div>
      ) : conversations === null ? (
        <ul className="conv-list" aria-busy="true" aria-label="Loading conversations">
          {[0, 1, 2].map((i) => (
            <li key={i} className="conv-row conv-row--skeleton">
              <Skeleton className="skeleton--avatar" />
              <span className="conv-row__body">
                <Skeleton width="40%" />
                <Skeleton width="75%" />
              </span>
            </li>
          ))}
        </ul>
      ) : conversations.length === 0 ? (
        <EmptyState
          Icon={MessageCircle}
          title="No conversations yet"
          action={
            <Link href="/feed" className="btn-secondary">
              Browse open requests
            </Link>
          }
        >
          When someone accepts your request to talk, or you accept theirs, the conversation appears here.
        </EmptyState>
      ) : (
        <ul className="conv-list" aria-label="Conversations">
          {conversations.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} myId={myId} />
          ))}
        </ul>
      )}
    </main>
  );
}
