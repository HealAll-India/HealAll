"use client";

import { FormEvent, useEffect, useState } from "react";

import { verifyOtp } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export default function VerifyOtpPage() {
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("phone_or_email");
    if (value) {
      setPhoneOrEmail(value);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await verifyOtp({ phone_or_email: phoneOrEmail, otp_code: otpCode });
      setMessage(`${response.message} Current verification level: ${response.verification_level}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card stack">
        <h1>Verify OTP (Module 1)</h1>
        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Phone or Email
            <input
              value={phoneOrEmail}
              onChange={(event) => setPhoneOrEmail(event.target.value)}
              required
            />
          </label>
          <label>
            OTP Code
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <button disabled={loading} type="submit">
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
