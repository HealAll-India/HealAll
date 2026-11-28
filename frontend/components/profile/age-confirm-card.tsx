"use client";

import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { updateMyProfile } from "@/lib/api/users";
import { ageRanges } from "@/lib/constants";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { AgeRange, MyUserProfile } from "@/lib/types/api";

/**
 * Shown to a member whose account still says 13 to 17. HealAll is 18+, so
 * those accounts close a week after a warning email, unless the member
 * confirms here that they are 18 or over.
 */
export function AgeConfirmCard({ onUpdated }: { onUpdated: (profile: MyUserProfile) => void }) {
  const token = useAuthStore((state) => state.accessToken);
  const [ageRange, setAgeRange] = useState<AgeRange>(ageRanges[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      onUpdated(await updateMyProfile(token, { age_range: ageRange }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your age range. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" role="alert" style={{ marginBottom: "16px", borderTop: "3px solid #d97706" }}>
      <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>HealAll is now for people 18 and over</h2>
      <p className="muted" style={{ margin: 0 }}>
        Your account says you are 13 to 17, so it will be closed. If you are 18 or over, pick your age range
        to keep your account.
      </p>
      <div className="row" style={{ gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 160px" }}>
          My age range
          <select value={ageRange} onChange={(e) => setAgeRange(e.target.value as AgeRange)} disabled={busy}>
            {ageRanges.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={confirm} disabled={busy}>
          {busy ? "Saving…" : "I'm 18 or over"}
        </button>
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </section>
  );
}
