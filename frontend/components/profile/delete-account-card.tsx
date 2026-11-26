"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { deleteMyAccount } from "@/lib/api/users";
import { useAuthStore } from "@/lib/stores/auth-store";

const CONFIRM_WORD = "DELETE";

/**
 * In-app account deletion, which Google Play requires for any app that lets
 * people create an account. Deletion is permanent, so the member types a
 * confirmation word before the button unlocks.
 */
export function DeleteAccountCard() {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || confirmText.trim() !== CONFIRM_WORD) return;
    const memberId = useAuthStore.getState().user?.id;
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount(token);
      // Someone else may have signed in on this device meanwhile; leave them be.
      if (useAuthStore.getState().user?.id !== memberId) return;
      clearSession();
      router.replace("/?account=deleted");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <section className="card stack delete-account" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title" className="delete-account__title">Delete account</h2>
      <p className="muted delete-account__text">
        This permanently deletes your profile, posts, comments and messages. It can&apos;t be undone.{" "}
        <Link href="/delete-account">What gets deleted</Link>
      </p>

      {!open ? (
        <button type="button" className="ghost delete-account__open" onClick={() => setOpen(true)}>
          Delete my account
        </button>
      ) : (
        <form className="stack delete-account__form" onSubmit={onSubmit}>
          <label>
            Type {CONFIRM_WORD} to confirm
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={deleting}
            />
          </label>
          <div className="row delete-account__actions">
            <button type="submit" className="danger" disabled={deleting || confirmText.trim() !== CONFIRM_WORD}>
              {deleting ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </section>
  );
}
