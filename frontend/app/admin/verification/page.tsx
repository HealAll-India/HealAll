"use client";

import { useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { rejectPost, requestInfo, verifyPost, getVerificationQueue } from "@/lib/api/verification";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { VerificationQueueItem } from "@/lib/types/api";

export default function VerificationAdminPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadQueue() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getVerificationQueue(token, 1, 30);
      setItems(response.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load verification queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function currentRemarks(postId: string) {
    return remarks[postId] ?? "Verified by admin panel";
  }

  async function act(postId: string, action: "verify" | "request-info" | "reject") {
    if (!token) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const note = currentRemarks(postId);
      if (action === "verify") {
        await verifyPost(token, postId, note);
      } else if (action === "request-info") {
        await requestInfo(token, postId, note);
      } else {
        await rejectPost(token, postId, note);
      }
      setMessage(`Applied ${action} for post ${postId}`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification action failed");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <section className="card stack">
            <h1>Verification Queue (Module 4 Admin)</h1>
            <p className="muted">Verifier/admin actions on submitted posts.</p>
            <button className="ghost" onClick={() => void loadQueue()} type="button">
              Refresh Queue
            </button>
          </section>

          {loading ? <p className="muted">Loading...</p> : null}
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <section className="grid">
            {items.map((item) => (
              <article className="card stack" key={item.post_id}>
                <div className="row">
                  <h3 style={{ margin: 0 }}>{item.title}</h3>
                  <span className="badge">{item.category}</span>
                  <span className="badge warn">{item.urgency}</span>
                </div>
                <p className="muted">
                  {item.city} · by {item.author.name} · submitted {item.submitted_at}
                </p>
                <label>
                  Remarks
                  <textarea
                    value={currentRemarks(item.post_id)}
                    onChange={(event) =>
                      setRemarks((prev) => ({
                        ...prev,
                        [item.post_id]: event.target.value
                      }))
                    }
                  />
                </label>
                <div className="row">
                  <button onClick={() => void act(item.post_id, "verify")} type="button">
                    Verify
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void act(item.post_id, "request-info")}
                    type="button"
                  >
                    Request Info
                  </button>
                  <button className="danger" onClick={() => void act(item.post_id, "reject")} type="button">
                    Reject
                  </button>
                </div>
              </article>
            ))}
            {!loading && items.length === 0 ? (
              <section className="card">
                <p className="muted">Verification queue is empty.</p>
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
