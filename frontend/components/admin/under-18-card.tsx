"use client";

import { useCallback, useEffect, useState } from "react";

import { closeUnder18, getUnder18Summary, warnUnder18 } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Under18SummaryResponse } from "@/lib/types/api";

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Head admins only. HealAll is 18+: members whose account still says 13 to 17
 * get one warning email, then their accounts close a week later unless they
 * confirm an adult age range on their profile.
 */
export function Under18Card() {
  const token = useAuthStore((s) => s.accessToken);
  const [summary, setSummary] = useState<Under18SummaryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setSummary(await getUnder18Summary(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load under-18 accounts.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: "warn" | "close") {
    if (!token || !summary) return;
    const question =
      action === "warn"
        ? `Email ${summary.not_warned} member(s) that their account will close in a week? This can't be unsent.`
        : `Permanently delete ${summary.due} account(s)? This can't be undone.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (action === "warn") {
        const r = await warnUnder18(token);
        setMessage(
          `Sent ${r.sent} warning(s)${r.failed ? `, ${r.failed} failed (press again to retry)` : ""}. They close on ${formatDay(r.close_on)}.`,
        );
      } else {
        const r = await closeUnder18(token);
        setMessage(`Closed ${r.closed} account(s).`);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" style={{ marginBottom: "16px" }} aria-label="Under-18 accounts">
      <h3 style={{ margin: 0 }}>Under-18 accounts</h3>
      {!summary ? (
        <p className={error ? "error" : "muted"} style={{ margin: 0 }}>
          {error ?? "Loading…"}
        </p>
      ) : summary.total === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No accounts say 13 to 17. Nothing to do.
        </p>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            {summary.total} account(s) say 13 to 17: {summary.not_warned} not warned yet, {summary.waiting} in their
            notice week, {summary.due} due to close.
            {summary.next_close_on && ` Next closing day: ${formatDay(summary.next_close_on)}.`}
          </p>
          {summary.staff > 0 && (
            <p className="muted" style={{ margin: 0 }}>
              {summary.staff} of them are moderators or admins and are skipped. Remove their role first.
            </p>
          )}
          <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => run("warn")} disabled={busy || summary.not_warned === 0}>
              Send warnings ({summary.not_warned})
            </button>
            <button type="button" onClick={() => run("close")} disabled={busy || summary.due === 0}>
              Close accounts ({summary.due})
            </button>
          </div>
          {message && (
            <p className="muted" style={{ margin: 0 }}>
              {message}
            </p>
          )}
          {error && (
            <p className="error" style={{ margin: 0 }}>
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
