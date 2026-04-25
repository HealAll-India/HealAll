"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { verifyOtp } from "@/lib/api/auth";
import { ApiError }  from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function VerifyOtpPage() {
  const router = useRouter();
  const setSession = useAuthStore(s => s.setSession);
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [digits,       setDigits]       = useState(["", "", "", "", "", ""]);
  const [loading,      setLoading]      = useState(false);
  const [message,      setMessage]      = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("phone_or_email");
    if (value) setPhoneOrEmail(value);
  }, []);

  function handleDigit(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await verifyOtp({ phone_or_email: phoneOrEmail, otp_code: digits.join("") });
      if (res.access_token && res.user) {
        // Fully verified — auto-login and go to feed
        setSession(res.access_token, res.user);
        router.push("/feed");
      } else {
        // Partially verified (shouldn't happen in current flow, but handle gracefully)
        setMessage(`${res.message} Please log in to continue.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  const otpComplete = digits.every(d => d !== "");

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "380px", borderRadius: "20px", padding: "36px 32px" }}>
        <div className="row" style={{ justifyContent: "center", marginBottom: "28px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>Verify your number</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "28px" }}>
          Enter the 6-digit code sent to {phoneOrEmail || "your phone"}
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "24px" }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: "46px", height: "54px", textAlign: "center",
                  fontSize: "22px", fontWeight: 700,
                  border: `1.5px solid ${d ? "#16a34a" : "#e5e7eb"}`,
                  borderRadius: "10px",
                  background: d ? "#f0fdf4" : "#f9fafb",
                  color: d ? "#16a34a" : "#111827",
                }}
              />
            ))}
          </div>
          <div className="stack" style={{ gap: "8px" }}>
            <button type="submit" disabled={loading || !otpComplete}>{loading ? "Verifying…" : "Verify"}</button>
            <button type="button" className="ghost" disabled={loading} onClick={() => setDigits(["", "", "", "", "", ""])}>Clear</button>
          </div>
        </form>
        {message ? <p className="success">{message}</p> : null}
        {error   ? <p className="error">{error}</p>     : null}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px" }}>
          Wrong number?{" "}<a href="/signup" style={{ color: "#16a34a", fontWeight: 600 }}>Go back</a>
        </p>
      </div>
    </main>
  );
}
