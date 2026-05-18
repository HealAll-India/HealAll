"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createPost, submitPost } from "@/lib/api/posts";
import { ApiError } from "@/lib/api/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CreatePostPayload } from "@/lib/types/api";
import { AuthRequired } from "@/components/ui/auth-required";
import { IndiaLocationPicker } from "@/components/ui/india-location-picker";
import { MapPicker } from "@/components/ui/map-picker";

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
    address: "",
    pincode: "",
    latitude: null,
    longitude: null,
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
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        // Non-API failure (network/CORS/abort). Surface the real reason instead
        // of a generic "Failed to create post" so users can act on it.
        setError(`Network error: ${err.message}. Check your connection and try again.`);
      } else {
        setError("Failed to create post");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <div>
            <a href="/feed" style={{ fontSize: "13px", color: "#6b7280", display: "inline-flex", alignItems: "center", gap: "4px" }}>← Back to feed</a>
          </div>
          <section className="card stack">
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Share a Request</h1>
            <p className="muted">Describe what you need — our community will help.</p>
          </section>
          <section className="card">
            <form className="grid" onSubmit={handleSubmit}>
              <div>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>What do you need?</h3>
                <div className="stack">
                  <label>Title<input value={payload.title} onChange={e => setPayload(p => ({ ...p, title: e.target.value }))} placeholder="Brief description of your request" minLength={5} required /></label>
                  <label>Description<textarea value={payload.description} onChange={e => setPayload(p => ({ ...p, description: e.target.value }))} placeholder="Share more details — who it's for, what's needed, timeline…" minLength={20} required /></label>
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Details</h3>
                <div className="row">
                  <label style={{ flex: 1 }}>Category
                    <select value={payload.category} onChange={e => setPayload(p => ({ ...p, category: e.target.value as CreatePostPayload["category"] }))}>
                      <option value="urgent">🆘 Urgent</option>
                      <option value="emotional_support">🤗 Emotional Support</option>
                      <option value="mentorship">🎓 Mentorship</option>
                      <option value="skill_sharing">🔧 Skill Sharing</option>
                      <option value="navigation">🧭 Navigation Help</option>
                      <option value="on_ground">🤝 On Ground</option>
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>Urgency
                    <select value={payload.urgency} onChange={e => setPayload(p => ({ ...p, urgency: e.target.value as CreatePostPayload["urgency"] }))}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">🟡 High</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </label>
                </div>
              </div>
              <div>
                <h3 className="section-label">
                  Location <span className="required-mark">*</span>
                </h3>
                <div className="stack location-stack">
                  <IndiaLocationPicker
                    value={payload.city}
                    onChange={(combined) => setPayload(p => ({ ...p, city: combined }))}
                    required
                  />
                  <div className="row location-row">
                    <label className="location-address">
                      Nearest landmark / address
                      <input
                        value={payload.address}
                        onChange={e => setPayload(p => ({ ...p, address: e.target.value }))}
                        placeholder="e.g. Near AIIMS Hospital Gate 3"
                        minLength={3}
                        maxLength={300}
                        required
                      />
                    </label>
                    <label className="location-pincode">
                      Pincode
                      <input
                        value={payload.pincode}
                        onChange={e => setPayload(p => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                        placeholder="110029"
                        inputMode="numeric"
                        pattern="^[1-9][0-9]{5}$"
                        required
                      />
                    </label>
                  </div>
                  <div className="location-safety" role="note" aria-label="Location privacy notice">
                    <strong>🔒 Stay safe with location sharing.</strong>
                    <ul>
                      <li>Drop the pin at a nearby <em>landmark</em> (hospital, metro station, intersection) — <strong>not</strong> your home, child&apos;s school, or workplace.</li>
                      <li>This pin is visible to everyone who can see your post. Once shared, assume it cannot be taken back.</li>
                      <li>Never include door numbers, gate codes, or floor details in the address field.</li>
                      <li>If unsure, leave the pin blank — city + pincode is enough for most help requests.</li>
                    </ul>
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: "11px" }}>
                      Your live device location is shown only to you and is never sent to our servers.
                    </p>
                  </div>
                  <MapPicker
                    latitude={payload.latitude ?? null}
                    longitude={payload.longitude ?? null}
                    onChange={(lat, lng) => setPayload(p => ({ ...p, latitude: lat, longitude: lng }))}
                    enableLocate
                  />
                </div>
              </div>
              <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <input type="checkbox" checked={submitNow} onChange={e => setSubmitNow(e.target.checked)} />
                Submit immediately for community review
              </label>
              <button disabled={loading} type="submit">{loading ? "Saving…" : "Post Request"}</button>
            </form>
            {message ? <p className="success">{message}</p> : null}
            {error   ? <p className="error">{error}</p>     : null}
          </section>
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
