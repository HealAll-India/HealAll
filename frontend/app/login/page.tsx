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
    <main className="page">
      <section className="card stack">
        <h1>Login (Module 1)</h1>
        <p className="muted">Use OTP-based login after signup + verification.</p>
        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Phone (+91...) or Email
            <input
              value={phoneOrEmail}
              onChange={(event) => setPhoneOrEmail(event.target.value)}
              placeholder="+919999999999 or user@example.com"
              required
            />
          </label>
          <label>
            OTP Code
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="6-digit code"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <div className="row">
            <button disabled={loading} type="submit">
              {loading ? "Signing in..." : "Login"}
            </button>
            <button
              className="ghost"
              disabled={loading}
              type="button"
              onClick={handleResendOtp}
            >
              Resend OTP
            </button>
          </div>
        </form>
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
