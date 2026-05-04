"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { addSkill, getMyProfile, updateMyProfile, updatePrivacy } from "@/lib/api/users";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { MyUserProfile } from "@/lib/types/api";

function VerificationBadge({ level }: { level: number }) {
  if (level === 0) return <span style={{ fontSize: "11px", color: "#9ca3af" }}>Unverified</span>;
  return (
    <span
      style={{
        background: "#dcfce7",
        color: "#16a34a",
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "999px",
      }}
    >
      ✓ Level {level} verified
    </span>
  );
}

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

function SkillChip({ skill }: { skill: string }) {
  return (
    <span
      style={{
        background: "#eff6ff",
        color: "#1d4ed8",
        fontSize: "12px",
        fontWeight: 600,
        padding: "3px 12px",
        borderRadius: "999px",
      }}
    >
      {skill}
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
      {/* Profile header */}
      {profile && (
        <section className="card" style={{ padding: "24px", marginBottom: "16px" }}>
          <div className="row" style={{ gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Avatar */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                flexShrink: 0,
                overflow: "hidden",
                background: "linear-gradient(135deg, #16a34a, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: 800,
                color: "#fff",
              }}
            >
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                profile.name[0]?.toUpperCase()
              )}
            </div>

            {/* Info */}
            <div className="stack" style={{ flex: 1, gap: "6px" }}>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>{profile.name}</h1>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                📍 {profile.city} · {profile.age_range}
              </p>

              <div className="row" style={{ gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                <VerificationBadge level={profile.verification_level} />
                {profile.roles.map((r) => <RolePill key={r} role={r} />)}
              </div>

              <div className="row" style={{ gap: "12px", marginTop: "4px" }}>
                {profile.email_verified && (
                  <span style={{ fontSize: "11px", color: "#16a34a" }}>✓ Email</span>
                )}
                {profile.phone_verified && (
                  <span style={{ fontSize: "11px", color: "#16a34a" }}>✓ Phone</span>
                )}
              </div>

              {profile.bio && (
                <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#374151", lineHeight: 1.5 }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </section>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Name
                  <input
                    value={profile.name}
                    onChange={(e) => setProfile((p) => p ? { ...p, name: e.target.value } : p)}
                    required
                  />
                </label>
                <label>
                  City
                  <input
                    value={profile.city}
                    onChange={(e) => setProfile((p) => p ? { ...p, city: e.target.value } : p)}
                    required
                  />
                </label>
              </div>
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
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Skills</h2>
            {profile.skills.length === 0 ? (
              <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
                No skills added yet. Skills help people find the right helper.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {profile.skills.map((skill) => (
                  <SkillChip key={skill} skill={skill} />
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
