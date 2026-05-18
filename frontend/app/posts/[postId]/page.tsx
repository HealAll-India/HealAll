"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthRequired } from "@/components/ui/auth-required";
import { createComment, listComments } from "@/lib/api/comments";
import { ApiError } from "@/lib/api/client";
import { createReport } from "@/lib/api/moderation";
import { requestConsent } from "@/lib/api/messages";
import { getPost } from "@/lib/api/posts";
import { reportReasons } from "@/lib/constants";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CommentResponse, PostResponse, ReportReason } from "@/lib/types/api";

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [post, setPost] = useState<PostResponse | null>(null);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [reportReason, setReportReason] = useState<ReportReason>("other");
  const [reportDescription, setReportDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use allSettled so a failing comments fetch can't blank the page.
      // Comments endpoint 404s on non-ACTIVE posts (draft / submitted /
      // needs_info / rejected) — but the author is still entitled to view
      // their own post in those states, so we must surface the post even
      // when the comments call rejects.
      const [postSettled, commentsSettled] = await Promise.allSettled([
        getPost(token, postId),
        listComments(token, postId),
      ]);

      if (postSettled.status === "fulfilled") {
        setPost(postSettled.value);
      } else {
        const err = postSettled.reason;
        setError(err instanceof ApiError ? err.message : "Failed to load post");
      }

      // Comments endpoint 404s on non-ACTIVE posts by design. Swallow
      // failures only for those statuses; on ACTIVE / RESOLVED posts a
      // failed comments fetch is a real error (timeout / 500 / auth)
      // and must surface so it isn't mistaken for "No comments yet."
      const commentsExpectedToWork =
        postSettled.status === "fulfilled" &&
        (postSettled.value.status === "active" || postSettled.value.status === "resolved");

      if (commentsSettled.status === "fulfilled") {
        setComments(commentsSettled.value);
      } else if (commentsExpectedToWork) {
        const err = commentsSettled.reason;
        setError(err instanceof ApiError ? err.message : "Failed to load comments");
        setComments([]);
      } else {
        setComments([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, postId]);

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !commentBody.trim()) {
      return;
    }

    setError(null);
    try {
      const created = await createComment(token, postId, commentBody.trim());
      setComments((prev) => [...prev, created]);
      setCommentBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add comment");
    }
  }

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await createReport(token, {
        target_type: "post",
        target_id: postId,
        reason: reportReason,
        description: reportDescription || undefined
      });
      setMessage("Report submitted.");
      setReportDescription("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to report post");
    }
  }

  async function handleRequestDmConsent() {
    if (!token || !post) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const consent = await requestConsent(token, post.author.id, post.id);
      setMessage(`Consent request sent. Request id: ${consent.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request DM consent");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <div>
            <a href="/feed" style={{ fontSize: "13px", color: "#6b7280", display: "inline-flex", alignItems: "center", gap: "4px" }}>← Back to feed</a>
          </div>
          {loading ? <p className="muted">Loading…</p> : null}
          {post ? (
            <>
              {post.status !== "active" && post.status !== "resolved" && (
                <section className="card stack post-pending-banner" role="status">
                  <strong>
                    {post.status === "submitted" && "🕒 Pending community verification"}
                    {post.status === "needs_info" && "ℹ️ Needs more information"}
                    {post.status === "draft" && "📝 Draft — not yet submitted"}
                    {post.status === "rejected" && "🚫 Rejected by moderators"}
                  </strong>
                  <p className="muted post-pending-banner__body">
                    {post.status === "submitted" &&
                      "Your post is visible only to you and verifiers right now. Once enough verified members approve it, it will appear in the public feed and comments will open."}
                    {post.status === "needs_info" &&
                      "A verifier asked for more details. Edit your post to provide them, then resubmit."}
                    {post.status === "draft" &&
                      "This post is saved as a draft. Submit it from the edit screen to begin verification."}
                    {post.status === "rejected" &&
                      "This post was rejected. If you believe this was a mistake, contact support."}
                  </p>
                </section>
              )}
              <section className="card stack">
                <div className="row" style={{ alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#16a34a,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "16px" }}>
                    {post.author.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
                      {post.author.name}
                      {post.author.verification_level >= 1 && <span className="vbadge">✓ Verified</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>{post.city} · L{post.author.verification_level}</div>
                  </div>
                  <span className={post.category === "urgent" ? "badge badge-urgent" : "badge"}>{post.category.replace(/_/g, " ")}</span>
                  <span className={`badge${post.urgency === "critical" ? " badge-urgent" : ""}`}>{post.urgency}</span>
                </div>
                <h2 style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 800 }}>{post.title}</h2>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{post.description}</p>
                <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                  {(post.status === "active" || post.status === "resolved") && (
                    <button className="secondary" onClick={handleRequestDmConsent} type="button">💬 Send Message</button>
                  )}
                  <span className="badge" style={{ background: "#f9fafb", color: "#6b7280" }}>{post.status}</span>
                </div>
              </section>

              {(post.address || post.pincode || (post.latitude != null && post.longitude != null)) && (
                <section className="card stack">
                  <h3 className="post-loc-title">📍 Location</h3>
                  {post.address && <p className="post-loc-address">{post.address}</p>}
                  <p className="muted post-loc-meta">
                    {post.city}{post.pincode ? ` · ${post.pincode}` : ""}
                  </p>
                  {post.latitude != null && post.longitude != null && (
                    <a
                      className="secondary"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${post.latitude},${post.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: "fit-content", textDecoration: "none" }}
                    >
                      🧭 Get Directions
                    </a>
                  )}
                </section>
              )}

              {(post.status === "active" || post.status === "resolved") && (
                <section className="card stack">
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Comments</h3>
                  <form className="row" onSubmit={handleCreateComment}>
                    <input value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Write a public comment…" style={{ flex: 1 }} />
                    <button type="submit">Post</button>
                  </form>
                  <div className="stack">
                    {comments.map(comment => (
                      <article className="card" key={comment.id} style={{ padding: "12px 14px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "13px" }}>{comment.body}</p>
                        <p className="muted" style={{ fontSize: "11px" }}>{comment.author.name} · L{comment.author.verification_level}</p>
                      </article>
                    ))}
                    {!loading && comments.length === 0 ? <p className="muted">No comments yet.</p> : null}
                  </div>
                </section>
              )}

              <section className="card stack">
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#6b7280" }}>Report this post</h3>
                <form className="grid" onSubmit={handleReport}>
                  <label>Reason
                    <select value={reportReason} onChange={e => setReportReason(e.target.value as ReportReason)}>
                      {reportReasons.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label>Description (optional)<textarea value={reportDescription} onChange={e => setReportDescription(e.target.value)} placeholder="Additional context" /></label>
                  <button className="ghost" type="submit" style={{ width: "fit-content" }}>Submit Report</button>
                </form>
              </section>
            </>
          ) : null}
          {message ? <p className="success">{message}</p> : null}
          {error   ? <p className="error">{error}</p>     : null}
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
