"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, CircleAlert, Lock, SendHorizontal } from "lucide-react";

import { MessageList } from "@/components/messages/message-list";
import { AuthRequired } from "@/components/ui/auth-required";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { getConversation, sendMessage } from "@/lib/api/messages";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ConversationResponse, MessageResponse } from "@/lib/types/api";

/** Messages per page; page 1 is the newest. */
const PAGE_SIZE = 50;
/** The API's limit on a message body. */
const MAX_LENGTH = 2000;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const myId = useAuthStore((s) => s.user?.id ?? "");

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;
  // Keyed so moving to another conversation starts from a clean slate.
  return <Thread key={conversationId} token={token} conversationId={conversationId} myId={myId} />;
}

interface ThreadProps {
  token: string;
  conversationId: string;
  myId: string;
}

function Thread({ token, conversationId, myId }: ThreadProps) {
  const [conversation, setConversation] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // After the first load or a send, show the newest message. After loading
  // earlier ones, keep what the member was reading in place instead.
  const scrollIntent = useRef<{ kind: "bottom" } | { kind: "keep"; fromBottom: number }>({ kind: "bottom" });

  const loadLatest = useCallback(() => {
    getConversation(token, conversationId, 1, PAGE_SIZE)
      .then((detail) => {
        scrollIntent.current = { kind: "bottom" };
        setConversation(detail.conversation);
        setMessages(detail.messages);
        setHasMore(Boolean(detail.has_more));
        setPage(1);
      })
      .catch((err) => setLoadError(errorText(err, "We couldn't load this conversation.")));
  }, [token, conversationId]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const intent = scrollIntent.current;
    el.scrollTop = intent.kind === "bottom" ? el.scrollHeight : el.scrollHeight - intent.fromBottom;
  }, [messages]);

  async function loadEarlier() {
    if (loadingEarlier) return;
    setLoadingEarlier(true);
    // A retry starts clean; a failure sets the notice again below.
    setLoadError(null);
    try {
      const detail = await getConversation(token, conversationId, page + 1, PAGE_SIZE);
      const el = scrollRef.current;
      scrollIntent.current = { kind: "keep", fromBottom: el ? el.scrollHeight - el.scrollTop : 0 };
      // A message sent since page 1 loaded shifts the pages by one; drop any repeat.
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        return [...detail.messages.filter((m) => !known.has(m.id)), ...current];
      });
      setHasMore(Boolean(detail.has_more));
      setPage((p) => p + 1);
    } catch (err) {
      setLoadError(errorText(err, "We couldn't load earlier messages."));
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    setBody("");
    try {
      const message = await sendMessage(token, conversationId, text);
      scrollIntent.current = { kind: "bottom" };
      setMessages((current) => [...current, message]);
    } catch (err) {
      setSendError(errorText(err, "Your message wasn't sent. Please try again."));
      setBody(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const name = conversation?.other_member?.name ?? "HealAll member";
  const ended = Boolean(conversation?.ended_at);

  return (
    <main className="thread">
      <header className="thread__head">
        <Link href="/messages" className="thread__back" aria-label="All messages">
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        {conversation ? (
          <>
            <Avatar name={name} src={conversation.other_member?.avatar_url} />
            <div className="thread__who">
              <h1 className="thread__name">{name}</h1>
              {ended ? <p className="thread__meta">Conversation ended</p> : null}
            </div>
          </>
        ) : (
          <span className="thread__who" aria-hidden="true">
            <Skeleton width="45%" />
          </span>
        )}
      </header>

      <div className="thread__body" ref={scrollRef}>
        {loadError ? (
          <div className="notice notice--error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{loadError}</p>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setLoadError(null);
                if (!conversation) loadLatest();
              }}
            >
              {conversation ? "Dismiss" : "Try again"}
            </button>
          </div>
        ) : null}

        {!conversation && !loadError ? (
          <p className="thread__status" role="status">
            Loading conversation…
          </p>
        ) : null}

        {conversation && hasMore ? (
          <button type="button" className="ghost thread__earlier" onClick={loadEarlier} disabled={loadingEarlier}>
            {loadingEarlier ? "Loading…" : "Load earlier messages"}
          </button>
        ) : null}

        {conversation && messages.length === 0 ? (
          <p className="thread__status">
            {ended ? "No messages were sent before this conversation ended." : `No messages yet. Say hello to ${name}.`}
          </p>
        ) : null}

        {messages.length > 0 ? <MessageList messages={messages} myId={myId} otherName={name} /> : null}
      </div>

      {conversation && ended ? (
        <p className="thread__ended">
          <Lock size={16} aria-hidden="true" />
          This conversation has ended. You can still read it.
        </p>
      ) : conversation ? (
        <form className="thread__compose" onSubmit={send}>
          {sendError ? (
            <p className="thread__send-error" role="alert">
              {sendError}
            </p>
          ) : null}
          <label htmlFor="thread-input" className="sr-only">
            Message {name}
          </label>
          <input
            id="thread-input"
            ref={inputRef}
            className="thread__input"
            value={body}
            // Read-only while sending, so a failed send can restore its text
            // without overwriting anything typed in the meantime.
            readOnly={sending}
            onChange={(e) => {
              setBody(e.target.value);
              if (sendError) setSendError(null);
            }}
            placeholder="Write a message…"
            maxLength={MAX_LENGTH}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="thread__send" disabled={sending || !body.trim()} aria-label="Send">
            <SendHorizontal size={20} aria-hidden="true" />
          </button>
        </form>
      ) : null}
    </main>
  );
}
