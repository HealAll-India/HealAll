"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getPublicPost, listPublicComments } from "@/lib/api/public";
import type {
  PublicCommentResponse,
  PublicPostDetail
} from "@/lib/types/public";

interface Props {
  postId: string;
}

/**
 * Read-only post view for logged-out visitors. Drives:
 *   - GET /v1/public/posts/{id}
 *   - GET /v1/public/posts/{id}/comments
 *
 * All write CTAs are anchors to /signup?next=... — no auth-required API is
 * called from this component, so we never trigger a stray 401 + auth:expired
 * dispatch from the API client.
 */
export function PublicPostView({ postId }: Props) {
  const [post, setPost] = useState<PublicPostDetail | null>(null);
  const [comments, setComments] = useState<PublicCommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [p, c] = await Promise.all([
        getPublicPost(postId),
        listPublicComments(postId)
      ]);
      if (!active) return;
      if (!p) {
        setNotFound(true);
      } else {
        setPost(p);
        setComments(c ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [postId]);

  const signupHref = `/signup?next=/posts/${postId}`;
  const loginHref = `/login?next=/posts/${postId}`;

  if (loading) {
    return <p className="muted">Loading…</p>;
  }

  if (notFound || !post) {
    return (
      <section className="card stack">
        <h2 className="public-post-view__h2">Post unavailable</h2>
        <p className="muted">
          This post is no longer publicly visible. It may have been resolved,
          removed, or not yet verified.
        </p>
        <Link href="/" className="btn-ghost btn-sm">
          ← Back to home
        </Link>
      </section>
    );
  }

  return (
    <>
      <div>
        <Link href="/" className="public-post-view__back">
          ← Home
        </Link>
      </div>

      <section className="card stack">
        <div className="row public-post-view__author">
          <div className="public-post-view__avatar" aria-hidden="true">
            {post.author.name[0]?.toUpperCase() ?? "·"}
          </div>
          <div className="public-post-view__author-meta">
            <div className="public-post-view__author-name">
              {post.author.name}
              {post.author.verification_level >= 1 && (
                <span className="vbadge">✓ Verified</span>
              )}
            </div>
            <div className="public-post-view__author-sub">
              {post.city} · L{post.author.verification_level}
            </div>
          </div>
          <span
            className={post.category === "urgent" ? "badge badge-urgent" : "badge"}
          >
            {post.category.replace(/_/g, " ")}
          </span>
          <span
            className={`badge${post.urgency === "critical" ? " badge-urgent" : ""}`}
          >
            {post.urgency}
          </span>
        </div>
        <h2 className="public-post-view__title">{post.title}</h2>
        <p className="public-post-view__body">{post.description}</p>
        <div className="row public-post-view__actions">
          <Link href={signupHref} className="btn-primary btn-sm">
            ♥ Sign up to help
          </Link>
          <Link href={loginHref} className="btn-ghost btn-sm">
            I have an invite
          </Link>
          <span className="public-post-view__helpers">
            {post.helper_count} helping
          </span>
        </div>
      </section>

      <section className="card stack">
        <h3 className="post-comments-title">Comments ({comments.length})</h3>
        <div className="stack">
          {comments.length === 0 ? (
            <p className="muted">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <article className="card post-comment-card" key={comment.id}>
                <p className="post-comment-body">{comment.body}</p>
                <p className="muted post-comment-meta">
                  {comment.author.name} · L{comment.author.verification_level}
                </p>
              </article>
            ))
          )}
        </div>
        <p className="muted public-post-view__hint">
          Want to comment or offer help?{" "}
          <Link href={signupHref}>Sign up</Link> — it&apos;s invite-only and free.
        </p>
      </section>
    </>
  );
}

export default PublicPostView;
