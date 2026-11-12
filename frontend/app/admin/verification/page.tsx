"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, RefreshCw } from "lucide-react";

import { MIN_NOTE_LENGTH, QueueCard, type QueueDecision } from "@/components/admin/queue-card";
import { StaffOnly } from "@/components/admin/staff-only";
import { canOpenStaffPage } from "@/components/layout/nav-config";
import { AuthRequired } from "@/components/ui/auth-required";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { getVerificationQueue, rejectPost, requestInfo, verifyPost } from "@/lib/api/verification";
import { plural } from "@/lib/format";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { VerificationQueueResponse } from "@/lib/types/api";

const NO_ROLES: readonly string[] = [];
const PAGE_SIZE = 30;

const DECISIONS: Record<QueueDecision, { send: typeof verifyPost; done: string }> = {
  verify: { send: verifyPost, done: "Verified. The request is live and a case was opened." },
  "request-info": { send: requestInfo, done: "Marked as needing more information from the member." },
  reject: { send: rejectPost, done: "Request rejected." },
};

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function VerificationAdminPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const roles = useAuthStore((s) => s.user?.roles) ?? NO_ROLES;
  const allowed = canOpenStaffPage("/admin/verification", roles);

  // null while loading; oldest submissions first once loaded.
  const [queue, setQueue] = useState<VerificationQueueResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !allowed) return;
    let current = true;
    getVerificationQueue(token, 1, PAGE_SIZE)
      .then((res) => {
        if (current) setQueue(res);
      })
      .catch((err) => {
        if (current) setLoadError(messageOf(err, "We couldn't load the queue."));
      });
    return () => {
      current = false;
    };
  }, [token, allowed, reloads]);

  function reload() {
    setLoadError(null);
    setReloads((n) => n + 1);
  }

  async function decide(postId: string, decision: QueueDecision) {
    if (!token) return;
    const note = (notes[postId] ?? "").trim();
    if (note.length < MIN_NOTE_LENGTH) return;

    setActingOn(postId);
    setActionError(null);
    setDone(null);
    try {
      await DECISIONS[decision].send(token, postId, note);
      setDone(DECISIONS[decision].done);
      // Every decision takes the request out of the queue.
      setQueue((prev) =>
        prev
          ? { ...prev, items: prev.items.filter((i) => i.post_id !== postId), total: Math.max(0, prev.total - 1) }
          : prev,
      );
      setNotes((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      reload();
    } catch (err) {
      setActionError(messageOf(err, "That decision didn't go through. Try again."));
    } finally {
      setActingOn(null);
    }
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  const showingSome = queue !== null && queue.total > queue.items.length;

  return (
    <main className="page admin-page">
      <PageHeader
        title="Verification queue"
        subtitle={
          queue && queue.total > 0
            ? `${plural(queue.total, "request")} waiting, oldest first.`
            : "Check each request before it goes live."
        }
        actions={
          allowed ? (
            <button type="button" className="ghost btn-sm" onClick={reload} disabled={queue === null && !loadError}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          ) : null
        }
      />

      {!allowed ? (
        <StaffOnly who="verifiers" />
      ) : (
        <div className="admin-sections">
          {done ? (
            <div className="notice notice--success" role="status">
              <CircleCheck size={18} aria-hidden="true" />
              <p>{done}</p>
            </div>
          ) : null}
          {actionError ? (
            <div className="notice notice--error" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <p>{actionError}</p>
            </div>
          ) : null}

          {loadError ? (
            <div className="notice notice--error" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <p>{loadError}</p>
              <button type="button" className="ghost btn-sm" onClick={reload}>
                Try again
              </button>
            </div>
          ) : queue === null ? (
            <ListSkeleton count={2} label="Loading the queue" />
          ) : queue.items.length === 0 ? (
            <EmptyState Icon={CircleCheck} title="All caught up">
              No requests are waiting for verification.
            </EmptyState>
          ) : (
            <>
              <ul className="queue-list">
                {queue.items.map((item) => (
                  <li key={item.post_id}>
                    <QueueCard
                      item={item}
                      note={notes[item.post_id] ?? ""}
                      onNoteChange={(value) => setNotes((prev) => ({ ...prev, [item.post_id]: value }))}
                      onDecide={(decision) => void decide(item.post_id, decision)}
                      acting={actingOn === item.post_id}
                    />
                  </li>
                ))}
              </ul>
              {showingSome ? (
                <p className="admin-footnote">
                  Showing the oldest {queue.items.length}. Newer requests appear as you clear these.
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </main>
  );
}
