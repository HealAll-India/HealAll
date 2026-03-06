"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createPost, submitPost } from "@/lib/api/posts";
import { ApiError } from "@/lib/api/client";
import { postCategories, postUrgencies } from "@/lib/constants";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CreatePostPayload } from "@/lib/types/api";
import { AuthRequired } from "@/components/ui/auth-required";

export default function NewPostPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [loading, setLoading] = useState(false);
  const [submitNow, setSubmitNow] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [payload, setPayload] = useState<CreatePostPayload>({
    title: "",
    description: "",
    category: "emotional_support",
    urgency: "normal",
    city: "",
    contact_prefs: { comments: true, dm_with_consent: true }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const created = await createPost(token, payload);
      if (submitNow) {
        await submitPost(token, created.id);
        setMessage("Post created and submitted for verification.");
      } else {
        setMessage("Post created as draft.");
      }
      router.push(`/posts/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create post");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card stack">
        <h1>Create Post (Module 3)</h1>
        <p className="muted">Draft and submit help requests.</p>
      </section>

      {!hydrated ? null : token ? (
        <section className="card">
          <form className="grid" onSubmit={handleSubmit}>
            <label>
              Title
              <input
                value={payload.title}
                onChange={(event) => setPayload((prev) => ({ ...prev, title: event.target.value }))}
                minLength={5}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={payload.description}
                onChange={(event) => setPayload((prev) => ({ ...prev, description: event.target.value }))}
                minLength={20}
                required
              />
            </label>
            <div className="row">
              <label style={{ flex: 1 }}>
                Category
                <select
                  value={payload.category}
                  onChange={(event) =>
                    setPayload((prev) => ({ ...prev, category: event.target.value as CreatePostPayload["category"] }))
                  }
                >
                  {postCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                Urgency
                <select
                  value={payload.urgency}
                  onChange={(event) =>
                    setPayload((prev) => ({ ...prev, urgency: event.target.value as CreatePostPayload["urgency"] }))
                  }
                >
                  {postUrgencies.map((urgency) => (
                    <option key={urgency} value={urgency}>
                      {urgency}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              City
              <input
                value={payload.city}
                onChange={(event) => setPayload((prev) => ({ ...prev, city: event.target.value }))}
                required
              />
            </label>
            <label>
              <input
                checked={submitNow}
                onChange={(event) => setSubmitNow(event.target.checked)}
                type="checkbox"
              />
              Submit immediately for verification
            </label>
            <button disabled={loading} type="submit">
              {loading ? "Saving..." : "Create Post"}
            </button>
          </form>
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
