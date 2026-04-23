"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { signup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { ageRanges } from "@/lib/constants";
import type { SignupRequest } from "@/lib/types/api";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SignupRequest>({
    name: "",
    phone: "",
    email: "",
    city: "",
    age_range: "25-34",
    invite_code: "",
    roles: ["help_seeker"]
  });

  function setRole(role: "helper" | "help_seeker", checked: boolean) {
    const roleSet = new Set(formData.roles);
    if (checked) {
      roleSet.add(role);
    } else {
      roleSet.delete(role);
    }

    const nextRoles = Array.from(roleSet);
    setFormData((prev) => ({ ...prev, roles: nextRoles as SignupRequest["roles"] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (formData.roles.length === 0) {
      setError("Choose at least one role");
      return;
    }

    setLoading(true);
    try {
      const response = await signup(formData);
      setMessage(response.message);
      // Phone OTP bypassed (coming soon) — redirect to email verification
      router.push(`/verify-otp?phone_or_email=${encodeURIComponent(formData.email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "440px", borderRadius: "20px", padding: "36px 32px" }}>
        <div className="row" style={{ justifyContent: "center", marginBottom: "24px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 4px" }}>Join HealAll</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "16px" }}>India&apos;s mutual-aid community</p>
        <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#7c3aed", textAlign: "center", marginBottom: "20px" }}>
          🔒 Invite-only — enter your invite code below
        </div>
        <form className="grid" onSubmit={handleSubmit}>
          <label>Invite Code<input value={formData.invite_code} onChange={e => setFormData(prev => ({ ...prev, invite_code: e.target.value }))} placeholder="HEAL-XXXXXX" required /></label>
          <label>Full Name<input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Your name" required /></label>
          <div className="row">
            <label style={{ flex: 1 }}>
              Phone (+91…)
              <input value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+919999999999" required />
              <span style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px", display: "block" }}>📱 SMS verification coming soon</span>
            </label>
            <label style={{ flex: 1 }}>Email<input type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} required /></label>
          </div>
          <div className="row">
            <label style={{ flex: 1 }}>City<input value={formData.city} onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))} required /></label>
            <label style={{ flex: 1 }}>Age Range
              <select value={formData.age_range} onChange={e => setFormData(prev => ({ ...prev, age_range: e.target.value as SignupRequest["age_range"] }))}>
                {ageRanges.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "12px 14px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#374151", margin: "0 0 10px" }}>I want to…</p>
            <div className="stack" style={{ gap: "6px" }}>
              <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151" }}>
                <input type="checkbox" checked={formData.roles.includes("help_seeker")} onChange={e => setRole("help_seeker", e.target.checked)} />
                Seek help from the community
              </label>
              <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151" }}>
                <input type="checkbox" checked={formData.roles.includes("helper")} onChange={e => setRole("helper", e.target.checked)} />
                Offer help to others
              </label>
            </div>
          </div>
          <button disabled={loading} type="submit" style={{ marginTop: "4px" }}>{loading ? "Creating account…" : "Create account"}</button>
        </form>
        {message ? <p className="success">{message}</p> : null}
        {error   ? <p className="error">{error}</p>     : null}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
          Already have an account?{" "}<a href="/login" style={{ color: "#16a34a", fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
    </main>
  );
}
