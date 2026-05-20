"use client";

import { useEffect, useRef, useState } from "react";

import { submitIssueReport } from "@/lib/api/issue-reports";

type Status = "idle" | "loading" | "success" | "error";

export function ReportIssueFab() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      await submitIssueReport({
        description: description.trim(),
        contact_email: email.trim() || undefined,
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
        website
      });
      setStatus("success");
      setDescription("");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="fab-root" ref={rootRef}>
      {open && (
        <div className="fab-panel" role="dialog" aria-label="Report an issue">
          {status === "success" ? (
            <div className="stack">
              <p className="fab-panel__title">Thanks — your report is logged.</p>
              <p className="fab-panel__note">
                We&apos;ll take a look soon. Want to follow along? Browse open reports on{" "}
                <a
                  href="https://github.com/HealAll-India/HealAll/issues?q=label%3Auser-report"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                .
              </p>
              <div className="row">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setStatus("idle");
                    setOpen(false);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form className="stack" onSubmit={handleSubmit}>
              <p className="fab-panel__title">Found a bug or have feedback?</p>
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? Steps to reproduce help us a lot."
                className="fab-panel__textarea"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email (optional)"
                autoComplete="email"
                className="fab-panel__input"
              />
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="visually-hidden"
                aria-hidden="true"
              />
              <div className="row fab-panel__actions">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-sm" disabled={status === "loading"}>
                  {status === "loading" ? "Sending…" : "Send"}
                </button>
              </div>
              {status === "error" && (
                <p className="error">Couldn&apos;t send. Please try again later.</p>
              )}
            </form>
          )}
        </div>
      )}
      <button
        type="button"
        className="fab-button"
        aria-label={open ? "Close report form" : "Report an issue"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">💬</span>
        <span className="fab-button__label">Report issue</span>
      </button>
    </div>
  );
}

export default ReportIssueFab;
