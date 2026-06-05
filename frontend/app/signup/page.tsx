"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getGoogleNonce, googleSignup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { ageRanges } from "@/lib/constants";
import type { AgeRange, UserRole } from "@/lib/types/api";
import { IndiaLocationPicker } from "@/components/ui/india-location-picker";

type Step = "invite" | "phone";

interface GoogleData {
  id_token: string;
  email: string;
  name: string;
  nonce?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const setSession = useAuthStore(s => s.setSession);

  useAuthRedirect();

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleBtnWidth, setGoogleBtnWidth] = useState<number | null>(null);
  // Server-issued single-use nonce — GIS embeds it in the ID token; backend
  // verifies + consumes it to block replay. Captured into googleData at
  // button-click time and sent with the eventual signup POST.
  const [googleNonce, setGoogleNonce] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getGoogleNonce()
      .then((res) => {
        if (active) setGoogleNonce(res.nonce);
      })
      .catch(() => {
        if (active) setGoogleNonce(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const el = googleBtnRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const width = Math.floor(el.getBoundingClientRect().width);
      if (width > 0) {
        setGoogleBtnWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [step, setStep]               = useState<Step>("invite");
  const [inviteCode, setInviteCode]   = useState("");
  const [googleData, setGoogleData]   = useState<GoogleData | null>(null);

  // Phone-step fields
  const [phone, setPhone]       = useState("");
  const [city, setCity]         = useState("");
  const [ageRange, setAgeRange] = useState<AgeRange>("25-34");
  const [roles, setRoles]       = useState<Extract<UserRole, "help_seeker" | "helper">[]>(["help_seeker"]);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function toggleRole(role: "help_seeker" | "helper", checked: boolean) {
    setRoles(prev => {
      const s = new Set(prev);
      checked ? s.add(role) : s.delete(role);
      return Array.from(s) as typeof roles;
    });
  }

  function handleGoogleSuccess(credential: string) {
    if (!inviteCode.trim()) {
      setError("Enter an invite code first");
      return;
    }
    try {
      const payload = JSON.parse(atob(credential.split(".")[1]));
      setGoogleData({
        id_token: credential,
        email: payload.email ?? "",
        name: payload.name ?? "",
        nonce: googleNonce ?? undefined,
      });
      setError(null);
      setStep("phone");
    } catch {
      setError("Could not read Google account info. Please try again.");
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!googleData) return;
    if (roles.length === 0) { setError("Choose at least one role"); return; }

    setError(null);
    setLoading(true);
    try {
      // Normalise Indian phone numbers to strict E.164 (+91 + 10 digits).
      // Users commonly type one of:
      //   "9876543210", "09876543210", "+91 9876543210", "91 9876543210",
      //   "(0) 98765-43210"
      // Backend regex is ^\+91\d{10}$ — anything else returns a 422
      // "Request validation failed" so we MUST collapse the variants
      // here before POSTing.
      const digits = phone.trim().replace(/[^\d]/g, "");
      const local10 = digits.startsWith("91") && digits.length === 12
        ? digits.slice(2)
        : digits.startsWith("0") && digits.length === 11
        ? digits.slice(1)
        : digits;
      if (local10.length !== 10) {
        setError("Enter a 10-digit Indian mobile number.");
        setLoading(false);
        return;
      }
      const normalizedPhone = `+91${local10}`;

      const res = await googleSignup({
        invite_code: inviteCode,
        id_token: googleData.id_token,
        nonce: googleData.nonce,
        phone: normalizedPhone,
        city,
        age_range: ageRange,
        roles,
      });
      setSession(res.access_token, res.user);
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "440px", borderRadius: "20px", padding: "36px 32px" }}>

        {/* Logo */}
        <div className="row" style={{ justifyContent: "center", marginBottom: "24px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>

        {/* ── Step 1: Invite + Google ── */}
        {step === "invite" && (
          <>
            <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 4px" }}>Join HealAll</h1>
            <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "16px" }}>
              India&apos;s mutual-aid community
            </p>
            <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#7c3aed", textAlign: "center", marginBottom: "20px" }}>
              🔒 Invite-only — enter your invite code below
            </div>

            <div className="stack" style={{ gap: "14px" }}>
              <label>
                Invite Code
                <input
                  value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value); setError(null); }}
                  placeholder="HEAL-XXXXXX"
                  autoFocus
                />
              </label>

              {/* Google sign-up button */}
              <div ref={googleBtnRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "100%", overflow: "hidden" }}>
                {googleBtnWidth ? (
                  <GoogleLogin
                    onSuccess={cr => cr.credential && handleGoogleSuccess(cr.credential)}
                    onError={() => setError("Google sign-in failed. Please try again.")}
                    text="continue_with"
                    shape="rectangular"
                    theme="outline"
                    width={googleBtnWidth}
                    nonce={googleNonce ?? undefined}
                  />
                ) : (
                  <div className="google-btn-placeholder" />
                )}
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                  Google provides your name and email
                </span>
              </div>

              {/* OTP fallback */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#9ca3af", fontSize: "12px" }}>
                <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
                or
                <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
              </div>
              <a
                href="/signup/otp"
                style={{ textAlign: "center", fontSize: "13px", color: "#16a34a", fontWeight: 600 }}
              >
                Sign up with email + OTP instead →
              </a>
            </div>
          </>
        )}

        {/* ── Step 2: Phone + profile ── */}
        {step === "phone" && googleData && (
          <>
            <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>
              Almost there!
            </h1>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#166534", textAlign: "center", marginBottom: "20px" }}>
              ✓ Signed in as <strong>{googleData.name}</strong>
              <br />
              <span style={{ fontSize: "11px", color: "#4ade80" }}>{googleData.email}</span>
            </div>

            <form className="grid" onSubmit={handlePhoneSubmit}>
              <label>
                Phone
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9999999999"
                  required
                />
                <span className="sms-helper-text">
                  📱 SMS verification coming soon
                </span>
              </label>
              <IndiaLocationPicker value={city} onChange={setCity} required />

              <label>
                Age Range
                <select value={ageRange} onChange={e => setAgeRange(e.target.value as AgeRange)}>
                  {ageRanges.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>

              <div style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "12px 14px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#374151", margin: "0 0 10px" }}>I want to…</p>
                <div className="stack" style={{ gap: "6px" }}>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151" }}>
                    <input type="checkbox" checked={roles.includes("help_seeker")} onChange={e => toggleRole("help_seeker", e.target.checked)} />
                    Seek help from the community
                  </label>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151" }}>
                    <input type="checkbox" checked={roles.includes("helper")} onChange={e => toggleRole("helper", e.target.checked)} />
                    Offer help to others
                  </label>
                </div>
              </div>

              <div className="row" style={{ gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => { setStep("invite"); setGoogleData(null); setError(null); }}
                  style={{ flex: "0 0 auto", padding: "0 16px" }}
                >
                  ← Back
                </button>
                <button type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Creating account…" : "Join HealAll →"}
                </button>
              </div>
            </form>
          </>
        )}

        {error ? <p className="error">{error}</p> : null}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#16a34a", fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
    </main>
  );
}
