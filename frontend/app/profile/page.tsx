"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { IndiaLocationPicker } from "@/components/ui/india-location-picker";
import { ApiError } from "@/lib/api/client";
import { addSkill, getMyProfile, updateMyProfile, updatePrivacy } from "@/lib/api/users";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { MyUserProfile } from "@/lib/types/api";

function RolePill({ role }: { role: string }) {
  const labels: Record<string, string> = {
    help_seeker: "Help seeker",
    helper: "Helper",
    moderator: "Moderator",
    admin: "Admin",
    head_admin: "Head admin",
  };
  return (
    <span
      style={{
        background: "#f3f4f6",
        color: "#374151",
        fontSize: "11px",
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: "999px",
      }}
    >
      {labels[role] ?? role}
    </span>
  );
}

export default function ProfilePage() {
  const hydrated = useHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const sessionUser = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState<MyUserProfile | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadProfile() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setProfile(await getMyProfile(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateMyProfile(token, {
        name: profile.name,
        city: profile.city,
        bio: profile.bio ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
      setProfile(updated);
      if (sessionUser) {
        setSession(token, { ...sessionUser, name: updated.name, city: updated.city, avatar_url: updated.avatar_url });
      }
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function savePrivacy() {
    if (!token || !profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const privacy = await updatePrivacy(token, profile.privacy_settings);
      setProfile((prev) => (prev ? { ...prev, privacy_settings: privacy } : prev));
      setSuccess("Privacy settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update privacy");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSkill() {
    if (!token || !newSkill.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await addSkill(token, newSkill.trim());
      setNewSkill("");
      await loadProfile();
      setSuccess("Skill added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add skill");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) return null;
  if (!token) return <AuthRequired />;

  return (
    <main className="page">
      {/* Profile hero */}
      {profile && (
        <>
          <section className="prof-hero" style={{ marginBottom: "22px" }}>
            <div className="prof-hero__cover" />
            {/* Avatar */}
            <span
              className="av av-xl"
              style={{
                background: "linear-gradient(135deg, #16a34a, #2563eb)",
                position: "relative", zIndex: 1,
              }}
            >
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "9999px" }} />
              ) : (
                profile.name[0]?.toUpperCase()
              )}
            </span>

            {/* Info */}
            <div className="prof-hero__about">
              <div className="prof-hero__name">
                {profile.name}
                {profile.verification_level >= 1 && (
                  <span className="vpill">✓ Verified · L{profile.verification_level}</span>
                )}
              </div>
              <div className="prof-hero__handle">
                📍 {profile.city}
                {profile.age_range ? ` · ${profile.age_range}` : ""}
              </div>
              {profile.bio && <p className="prof-hero__bio">{profile.bio}</p>}
              <div className="prof-hero__meta">
                {profile.email_verified && <span>✓ Email verified</span>}
                {profile.phone_verified && <span>✓ Phone verified</span>}
                {profile.roles.map((r) => <RolePill key={r} role={r} />)}
              </div>
            </div>

            {/* Actions */}
            <div className="prof-hero__actions">
              <button type="button" style={{ fontSize: "13px" }}>Edit profile</button>
            </div>
          </section>

          {/* Stats grid */}
          <div className="stats-grid" style={{ marginBottom: "24px" }}>
            <div className="stat">
              <div className="stat__label">Verification</div>
              <div className="stat__num">L{profile.verification_level}</div>
              <div className="stat__sub">{profile.verification_level === 0 ? "Not verified" : "Verified member"}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Skills</div>
              <div className="stat__num">{profile.skills.length}</div>
              <div className="stat__sub">Ways to help</div>
            </div>
            <div className="stat">
              <div className="stat__label">Email</div>
              <div className="stat__num" style={{ fontSize: "16px", lineHeight: 1.6 }}>{profile.email_verified ? "✓" : "—"}</div>
              <div className="stat__sub">{profile.email_verified ? "Verified" : "Not verified"}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Phone</div>
              <div className="stat__num" style={{ fontSize: "16px", lineHeight: 1.6 }}>{profile.phone_verified ? "✓" : "—"}</div>
              <div className="stat__sub">{profile.phone_verified ? "Verified" : "Not verified"}</div>
            </div>
          </div>
        </>
      )}

      {loading && !profile && (
        <section className="card"><p className="muted">Loading profile…</p></section>
      )}

      {profile && (
        <>
          {/* Edit details */}
          <section className="card stack" style={{ marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Edit profile</h2>
            <form className="stack" onSubmit={saveProfile} style={{ gap: "12px" }}>
              <label>
                Name
                <input
                  value={profile.name}
                  onChange={(e) => setProfile((p) => p ? { ...p, name: e.target.value } : p)}
                  required
                />
              </label>
              <IndiaLocationPicker
                value={profile.city}
                onChange={(combined) => setProfile((p) => p ? { ...p, city: combined } : p)}
                required
              />
              <p className="muted profile-city-hint">
                Saved as &quot;City, State&quot; — visible to community members per your privacy settings.
              </p>
              <label>
                Bio
                <textarea
                  value={profile.bio ?? ""}
                  onChange={(e) => setProfile((p) => p ? { ...p, bio: e.target.value } : p)}
                  placeholder="Tell the community a bit about yourself…"
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </label>
              <button type="submit" disabled={saving} style={{ width: "fit-content" }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>

          {/* Skills */}
          <section className="card stack" style={{ marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Skills &amp; ways I can help</h2>
            {profile.skills.length === 0 ? (
              <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
                No skills added yet. Skills help people find the right helper.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {profile.skills.map((skill) => (
                  <span key={skill} className="skill-chip">{skill}</span>
                ))}
              </div>
            )}
            <div className="row" style={{ gap: "8px", marginTop: "4px" }}>
              <input
                placeholder="e.g. Legal advice, Medical, Coding…"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddSkill(); } }}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleAddSkill}
                type="button"
                className="ghost"
                disabled={saving || !newSkill.trim()}
              >
                Add
              </button>
            </div>
          </section>

          {/* Privacy */}
          <section className="card stack" style={{ marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Privacy</h2>
            <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
              Control what other community members can see on your public profile.
            </p>

            <div className="stack" style={{ gap: "12px" }}>
              {(
                [
                  { key: "show_email",     label: "Show email address",    desc: "Others can see your email on your profile" },
                  { key: "show_phone",     label: "Show phone number",     desc: "Others can see your phone on your profile" },
                  { key: "show_full_city", label: "Show full city name",   desc: "Others see your full city; otherwise just the region" },
                ] as const
              ).map(({ key, label, desc }) => (
                <label
                  key={key}
                  style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={profile.privacy_settings[key]}
                    onChange={(e) =>
                      setProfile((p) =>
                        p ? { ...p, privacy_settings: { ...p.privacy_settings, [key]: e.target.checked } } : p
                      )
                    }
                    style={{ marginTop: "2px", flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#374151" }}>{label}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <button onClick={savePrivacy} type="button" className="ghost" disabled={saving} style={{ width: "fit-content" }}>
              {saving ? "Saving…" : "Save privacy settings"}
            </button>
          </section>
        </>
      )}

      {success && <p className="success">{success}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
