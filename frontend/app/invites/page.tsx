"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { ApiError } from "@/lib/api/client";
import { createInvite, listInvites, revokeInvite } from "@/lib/api/invites";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { InviteCodeResponse } from "@/lib/types/api";

export default function InvitesPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [invites, setInvites] = useState<InviteCodeResponse[]>([]);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadInvites() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await listInvites(token, 50, 0);
      setInvites(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadInvites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const invite = await createInvite(token, maxUses, expiresInDays);
      setMessage(`Invite created: ${invite.code}`);
      await loadInvites();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create invite");
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!token) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await revokeInvite(token, inviteId);
      setMessage("Invite revoked.");
      await loadInvites();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke invite");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <section className="card stack">
            <h1>Invite Management (Module 1 Admin)</h1>
            <form className="row" onSubmit={handleCreateInvite}>
              <label>
                Max uses
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxUses}
                  onChange={(event) => setMaxUses(Number(event.target.value))}
                />
              </label>
              <label>
                Expires in days
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(Number(event.target.value))}
                />
              </label>
              <button type="submit">Create Invite</button>
              <button className="ghost" onClick={() => void loadInvites()} type="button">
                Refresh
              </button>
            </form>
          </section>

          {loading ? <p className="muted">Loading...</p> : null}
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <section className="grid">
            {invites.map((invite) => (
              <article className="card stack" key={invite.id}>
                <div className="row">
                  <strong>{invite.code}</strong>
                  <span className={`badge ${invite.is_available ? "ok" : "warn"}`}>
                    {invite.is_available ? "available" : "unavailable"}
                  </span>
                </div>
                <p className="muted">
                  use_count: {invite.use_count}/{invite.max_uses} · expires: {invite.expires_at}
                </p>
                <button className="danger" onClick={() => void handleRevoke(invite.id)} type="button">
                  Revoke
                </button>
              </article>
            ))}
            {!loading && invites.length === 0 ? (
              <section className="card">
                <p className="muted">No invites available.</p>
              </section>
            ) : null}
          </section>
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
