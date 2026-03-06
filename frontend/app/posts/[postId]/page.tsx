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
          <section className="card stack">
            <h1>Post Detail (Module 3)</h1>
            {loading ? <p className="muted">Loading...</p> : null}
            {post ? (
              <>
                <div className="row">
                  <h2 style={{ margin: 0 }}>{post.title}</h2>
                  <span className="badge">{post.category}</span>
                  <span className="badge warn">{post.urgency}</span>
                  <span className="badge">{post.status}</span>
                </div>
                <p>{post.description}</p>
                <p className="muted">
                  {post.city} · by {post.author.name} · level {post.author.verification_level}
                </p>
                <button className="secondary" onClick={handleRequestDmConsent} type="button">
                  Request DM Consent
                </button>
              </>
            ) : null}
          </section>

          <section className="card stack">
            <h3>Comments (Module 5)</h3>
            <form className="row" onSubmit={handleCreateComment}>
              <input
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Write a public comment"
                style={{ flex: 1 }}
              />
              <button type="submit">Post Comment</button>
            </form>

            <div className="stack">
              {comments.map((comment) => (
                <article className="card" key={comment.id}>
                  <p style={{ marginTop: 0 }}>{comment.body}</p>
                  <p className="muted">
                    {comment.author.name} · L{comment.author.verification_level}
                  </p>
                </article>
              ))}
              {!loading && comments.length === 0 ? <p className="muted">No comments yet.</p> : null}
            </div>
          </section>

          <section className="card stack">
            <h3>Report This Post (Module 6)</h3>
            <form className="grid" onSubmit={handleReport}>
              <label>
                Reason
                <select
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value as ReportReason)}
                >
                  {reportReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                  placeholder="Optional additional context"
                />
              </label>
              <button type="submit">Submit Report</button>
            </form>
          </section>

          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
