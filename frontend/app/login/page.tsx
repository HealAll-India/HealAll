"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { login, resendOtp } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();

  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await login({ phone_or_email: phoneOrEmail, otp_code: otpCode });
      setSession(response.access_token, response.user);
      setMessage("Login successful. Redirecting to feed...");
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError(null);
    setMessage(null);

    if (!phoneOrEmail.trim()) {
      setError("Enter phone or email first");
      return;
    }

    setLoading(true);
    try {
      const response = await resendOtp({ phone_or_email: phoneOrEmail });
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "400px", borderRadius: "20px", padding: "36px 32px" }}>
        <div className="row" style={{ justifyContent: "center", marginBottom: "28px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>Welcome back</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "24px" }}>Sign in with your OTP to continue</p>
        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Phone or Email
            <input value={phoneOrEmail} onChange={e => setPhoneOrEmail(e.target.value)} placeholder="+91 9999999999 or name@email.com" required />
          </label>
          <label>
            OTP Code
            <input value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="6-digit code" minLength={6} maxLength={6} required />
          </label>
          <div className="stack" style={{ gap: "8px", marginTop: "4px" }}>
            <button disabled={loading} type="submit">{loading ? "Signing in…" : "Sign in"}</button>
            <button className="ghost" disabled={loading} type="button" onClick={handleResendOtp}>Resend OTP</button>
          </div>
        </form>
        {message ? <p className="success">{message}</p> : null}
        {error   ? <p className="error">{error}</p>     : null}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px" }}>
          Don&apos;t have an account?{" "}<a href="/signup" style={{ color: "#16a34a", fontWeight: 600 }}>Sign up</a>
        </p>
      </div>
    </main>
  );
}
