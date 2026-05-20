"use client";

import { GoogleLogin } from "@react-oauth/google";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { googleLogin, login, resendOtp } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [expired, setExpired] = useState(false);

  useAuthRedirect();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setExpired(new URLSearchParams(window.location.search).get("reason") === "expired");
    }
  }, []);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleBtnWidth, setGoogleBtnWidth] = useState<number | null>(null);

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

  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [otpCode, setOtpCode]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [message, setMessage]           = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await login({ phone_or_email: phoneOrEmail, otp_code: otpCode });
      setSession(response.access_token, response.user);
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
    if (!phoneOrEmail.trim()) { setError("Enter phone or email first"); return; }
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

  async function handleGoogleSuccess(credential: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await googleLogin({ id_token: credential });
      setSession(res.access_token, res.user);
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Google login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "400px", borderRadius: "20px", padding: "36px 32px" }}>

        {/* Logo */}
        <div className="row" style={{ justifyContent: "center", marginBottom: "28px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>Welcome back</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "24px" }}>
          Sign in to continue
        </p>

        {expired ? (
          <p className="error login-expired-banner" role="alert" aria-live="assertive">
            Your session expired. Please sign in again.
          </p>
        ) : null}

        {/* ── Google sign-in — primary ── */}
        <div ref={googleBtnRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "20px", width: "100%", overflow: "hidden" }}>
          {googleBtnWidth ? (
            <GoogleLogin
              onSuccess={cr => cr.credential && handleGoogleSuccess(cr.credential)}
              onError={() => setError("Google sign-in failed. Please try again.")}
              text="signin_with"
              shape="rectangular"
              theme="outline"
              width={googleBtnWidth}
            />
          ) : (
            <div className="placeholder-spacer" />
          )}
        </div>

        {/* ── Divider ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#9ca3af", fontSize: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
          or sign in with OTP
          <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
        </div>

        {/* ── OTP form ── */}
        <form className="grid" onSubmit={handleOtpSubmit}>
          <label>
            Phone or Email
            <input
              value={phoneOrEmail}
              onChange={e => setPhoneOrEmail(e.target.value)}
              placeholder="+91 9999999999 or name@email.com"
              required
            />
          </label>
          <label>
            OTP Code
            <input
              value={otpCode}
              onChange={e => setOtpCode(e.target.value)}
              placeholder="6-digit code"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <div className="stack" style={{ gap: "8px", marginTop: "4px" }}>
            <button disabled={loading} type="submit">{loading ? "Signing in…" : "Sign in with OTP"}</button>
            <button className="ghost" disabled={loading} type="button" onClick={handleResendOtp}>Send OTP</button>
          </div>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error   ? <p className="error">{error}</p>     : null}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px" }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" style={{ color: "#16a34a", fontWeight: 600 }}>Sign up</a>
        </p>
      </div>
    </main>
  );
}
