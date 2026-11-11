"use client";

import { GoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { CircleAlert, Clock } from "lucide-react";

import { getGoogleNonce, googleLogin, login, resendOtp } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";

/** Seconds before "Resend code" unlocks; the API allows 5 codes an hour. */
const RESEND_COOLDOWN_S = 30;

function apiMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Cheap client check; the API normalises "98765 43210", "+91…", "0…" and emails. */
function identifierProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your mobile number or email.";
  if (!v.includes("@") && v.replace(/\D/g, "").length < 10) return "Enter a 10-digit mobile number or an email address.";
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const hydrated = useHydrated();
  useAuthRedirect();
  const expired = hydrated && new URLSearchParams(window.location.search).get("reason") === "expired";

  const [step, setStep] = useState<"identify" | "code">("identify");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  /** Codes sent so far; the status line says "new code" after a resend. */
  const [sends, setSends] = useState(0);
  const idRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Server-issued single-use nonce. GIS embeds it in the returned ID token;
  // the backend verifies + consumes it to block replay.
  const [googleNonce, setGoogleNonce] = useState<string | null>(null);
  const googleBoxRef = useRef<HTMLDivElement>(null);
  const [googleWidth, setGoogleWidth] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getGoogleNonce()
      .then((res) => {
        if (active) setGoogleNonce(res.nonce);
      })
      .catch(() => {
        // Non-fatal: backend treats a missing nonce as "verify token only".
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const el = googleBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      // GIS renders at most 400px wide.
      const width = Math.min(400, Math.floor(el.getBoundingClientRect().width));
      if (width > 0) setGoogleWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Move focus with the step so keyboard and screen-reader users land on the
  // next field. Not on first render: the page shouldn't pop the keyboard.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    (step === "code" ? codeRef : idRef).current?.focus();
  }, [step]);

  async function sendCode() {
    const problem = identifierProblem(identifier);
    if (problem) {
      setError(problem);
      idRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resendOtp({ phone_or_email: identifier.trim() });
      // Only the newest code works, so digits from the previous one must go.
      setCode("");
      // A resend keeps the step, so the step effect won't move focus.
      if (step === "code") codeRef.current?.focus();
      setStep("code");
      setSends((n) => n + 1);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(apiMessage(err, "We couldn't send a code. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      codeRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await login({ phone_or_email: identifier.trim(), otp_code: code });
      setSession(res.access_token, res.user);
      router.push("/feed");
    } catch (err) {
      // The code was right but no member uses this number/email.
      const noAccount = err instanceof ApiError && err.status === 404 && err.message === "User not found";
      setError(
        noAccount
          ? `No HealAll account uses ${identifier.trim()}. Check it, or join with an invite.`
          : apiMessage(err, "Sign-in failed. Please try again."),
      );
      setBusy(false);
      codeRef.current?.select();
    }
  }

  async function handleGoogle(credential: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await googleLogin({ id_token: credential, nonce: googleNonce ?? undefined });
      setSession(res.access_token, res.user);
      router.push("/feed");
    } catch (err) {
      setError(apiMessage(err, "Google sign-in failed. Please try again."));
      setBusy(false);
    }
  }

  function changeIdentifier() {
    setStep("identify");
    setCode("");
    setSends(0);
    setError(null);
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-brand">
          <Image src="/heart-mark.png" alt="" width={36} height={36} />
          HealAll
        </Link>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to help someone, or to ask for help.</p>

        {expired ? (
          <div className="notice notice--warning" role="status">
            <Clock size={18} aria-hidden="true" />
            <p>Your session expired. Please sign in again.</p>
          </div>
        ) : null}

        {step === "identify" ? (
          <>
            <div ref={googleBoxRef} className="auth-google">
              {googleWidth ? (
                <GoogleLogin
                  onSuccess={(cr) => cr.credential && handleGoogle(cr.credential)}
                  onError={() => setError("Google sign-in failed. Please try again.")}
                  text="signin_with"
                  shape="rectangular"
                  theme="outline"
                  width={googleWidth}
                  nonce={googleNonce ?? undefined}
                />
              ) : (
                <div className="google-btn-placeholder" />
              )}
            </div>

            <p className="auth-divider">or get a one-time code</p>

            <form
              className="auth-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <label htmlFor="login-id">Mobile number or email</label>
              <input
                id="login-id"
                ref={idRef}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="98765 43210 or you@example.com"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="login-id-hint"
                aria-invalid={error !== null && identifierProblem(identifier) !== null}
              />
              <p id="login-id-hint" className="auth-hint">
                Indian numbers work with or without +91.
              </p>
              <button type="submit" disabled={busy}>
                {busy ? "Sending code…" : "Send code"}
              </button>
            </form>
          </>
        ) : (
          <form className="auth-form" noValidate onSubmit={(e) => void signIn(e)}>
            <p className="auth-sent" role="status">
              We sent a {sends > 1 ? "new " : ""}6-digit code to <strong>{identifier.trim()}</strong>.{" "}
              <button type="button" className="auth-link" onClick={changeIdentifier} disabled={busy}>
                Change
              </button>
            </p>
            <label htmlFor="login-code">6-digit code</label>
            <input
              id="login-code"
              ref={codeRef}
              className="auth-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={error !== null}
            />
            <button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" className="ghost" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </form>
        )}

        {error ? (
          <div className="notice notice--error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        <p className="auth-footer">
          New here? HealAll is invite-only. <Link href="/signup">Join with an invite</Link>
        </p>
      </div>
    </main>
  );
}
