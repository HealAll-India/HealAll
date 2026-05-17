"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthRequired } from "@/components/ui/auth-required";
import { MapPicker } from "@/components/ui/map-picker";
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
      const [postResult, commentList] = await Promise.all([getPost(token, postId), listComments(token, postId)]);
      setPost(postResult);
      setComments(commentList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load post");
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
                  <button className="secondary" onClick={handleRequestDmConsent} type="button">💬 Send Message</button>
                  <span className="badge" style={{ background: "#f9fafb", color: "#6b7280" }}>{post.status}</span>
                </div>
              </section>

              {(post.address || post.pincode || (post.latitude !== null && post.longitude !== null)) && (
                <section className="card stack">
                  <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>📍 Location</h3>
                  {post.address && <p style={{ margin: 0, fontSize: "14px" }}>{post.address}</p>}
                  <p className="muted" style={{ fontSize: "12px", margin: 0 }}>
                    {post.city}{post.pincode ? ` · ${post.pincode}` : ""}
                  </p>
                  {post.latitude !== null && post.latitude !== undefined && post.longitude !== null && post.longitude !== undefined && (
                    <MapPicker
                      latitude={post.latitude}
                      longitude={post.longitude}
                      onChange={() => { /* read-only */ }}
                      readOnly
                      height={240}
                    />
                  )}
                </section>
              )}

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
