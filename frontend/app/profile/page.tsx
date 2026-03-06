"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { addSkill, getMyProfile, updateMyProfile, updatePrivacy } from "@/lib/api/users";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { MyUserProfile } from "@/lib/types/api";

export default function ProfilePage() {
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);
  const sessionUser = useAuthStore((state) => state.user);

  const [profile, setProfile] = useState<MyUserProfile | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadProfile() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getMyProfile(token);
      setProfile(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !profile) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const updated = await updateMyProfile(token, {
        name: profile.name,
        city: profile.city,
        bio: profile.bio ?? "",
        avatar_url: profile.avatar_url ?? ""
      });
      setProfile(updated);
      if (sessionUser) {
        setSession(token, { ...sessionUser, name: updated.name, city: updated.city, avatar_url: updated.avatar_url });
      }
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile");
    }
  }

  async function savePrivacy() {
    if (!token || !profile) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const privacy = await updatePrivacy(token, profile.privacy_settings);
      setProfile((prev) => (prev ? { ...prev, privacy_settings: privacy } : prev));
      setMessage("Privacy settings updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update privacy");
    }
  }

  async function createSkill() {
    if (!token || !newSkill.trim()) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await addSkill(token, newSkill.trim());
      setNewSkill("");
      await loadProfile();
      setMessage("Skill added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add skill");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <section className="card stack">
            <h1>My Profile (Module 2)</h1>
            {loading ? <p className="muted">Loading...</p> : null}
            {profile ? (
              <form className="grid" onSubmit={saveProfile}>
                <label>
                  Name
                  <input
                    value={profile.name}
                    onChange={(event) => setProfile((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                  />
                </label>
                <label>
                  City
                  <input
                    value={profile.city}
                    onChange={(event) => setProfile((prev) => (prev ? { ...prev, city: event.target.value } : prev))}
                  />
                </label>
                <label>
                  Bio
                  <textarea
                    value={profile.bio ?? ""}
                    onChange={(event) => setProfile((prev) => (prev ? { ...prev, bio: event.target.value } : prev))}
                  />
                </label>
                <label>
                  Avatar URL
                  <input
                    value={profile.avatar_url ?? ""}
                    onChange={(event) =>
                      setProfile((prev) => (prev ? { ...prev, avatar_url: event.target.value || null } : prev))
                    }
                  />
                </label>
                <button type="submit">Save Profile</button>
              </form>
            ) : null}
          </section>

          {profile ? (
            <section className="card stack">
              <h3>Privacy Settings</h3>
              <label>
                <input
                  checked={profile.privacy_settings.show_email}
                  onChange={(event) =>
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            privacy_settings: { ...prev.privacy_settings, show_email: event.target.checked }
                          }
                        : prev
                    )
                  }
                  type="checkbox"
                />
                Show email
              </label>
              <label>
                <input
                  checked={profile.privacy_settings.show_phone}
                  onChange={(event) =>
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            privacy_settings: { ...prev.privacy_settings, show_phone: event.target.checked }
                          }
                        : prev
                    )
                  }
                  type="checkbox"
                />
                Show phone
              </label>
              <label>
                <input
                  checked={profile.privacy_settings.show_full_city}
                  onChange={(event) =>
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            privacy_settings: { ...prev.privacy_settings, show_full_city: event.target.checked }
                          }
                        : prev
                    )
                  }
                  type="checkbox"
                />
                Show full city
              </label>
              <button onClick={savePrivacy} type="button">
                Save Privacy
              </button>
            </section>
          ) : null}

          {profile ? (
            <section className="card stack">
              <h3>Skills</h3>
              <p className="muted">{profile.skills.length ? profile.skills.join(", ") : "No skills added yet."}</p>
              <div className="row">
                <input
                  placeholder="Add a skill"
                  value={newSkill}
                  onChange={(event) => setNewSkill(event.target.value)}
                />
                <button onClick={createSkill} type="button">
                  Add Skill
                </button>
              </div>
            </section>
          ) : null}

          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
