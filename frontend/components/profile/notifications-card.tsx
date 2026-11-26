"use client";

import { useEffect, useState } from "react";

import { getPushPublicKey } from "@/lib/api/push";
import { disablePush, enablePush, getPushStatus, isPushSupported, type PushStatus } from "@/lib/push/web-push";
import { useAuthStore } from "@/lib/stores/auth-store";

/** `unavailable`: the API has no push keys yet, or couldn't be asked. */
type CardStatus = PushStatus | "unavailable" | "loading";

const STATUS_TEXT: Record<CardStatus, string> = {
  loading: "Checking…",
  on: "On for this device",
  off: "Off",
  blocked: "Blocked in browser settings",
  unsupported: "Not supported on this device",
  unavailable: "Not available yet",
};

/**
 * Turns push notifications on or off for this device. Permission is only
 * asked for when the member flips the switch, never on page load.
 */
export function NotificationsCard() {
  const token = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState<CardStatus>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!isPushSupported()) return "unsupported" as const;
      if (Notification.permission === "denied") return "blocked" as const;
      try {
        const config = await getPushPublicKey();
        if (!config.enabled || !config.public_key) return "unavailable" as const;
        if (!cancelled) setPublicKey(config.public_key);
        return await getPushStatus();
      } catch {
        return "unavailable" as const;
      }
    }
    void check().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const turningOn = status !== "on";
    try {
      if (turningOn) {
        if (!publicKey) return;
        setStatus(await enablePush(token, publicKey));
      } else {
        setStatus(await disablePush(token));
      }
    } catch {
      setError(turningOn ? "Couldn't turn on notifications. Please try again." : "Couldn't turn off notifications.");
      setStatus(await getPushStatus().catch((): CardStatus => "off"));
    } finally {
      setBusy(false);
    }
  }

  const switchable = status === "on" || status === "off";

  return (
    <section className="card stack notif-card" aria-labelledby="notif-card-title">
      <div className="notif-card__row">
        <div className="notif-card__text">
          <h2 id="notif-card-title" className="notif-card__title">
            Notifications
          </h2>
          <p className="notif-card__status" data-status={status}>
            {STATUS_TEXT[status]}
          </p>
        </div>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-label="Notifications on this device"
          checked={status === "on"}
          disabled={!switchable || busy || !token}
          onChange={toggle}
        />
      </div>
      <p className="muted notif-card__hint">
        Get a notification when someone messages you, comments on your post or offers to help. It never shows what
        they wrote.
      </p>
      {status === "blocked" && (
        <p className="muted notif-card__hint">
          To turn them on, allow notifications for HealAll in your browser or phone settings, then reload this page.
        </p>
      )}
      {error && <p className="error notif-card__error">{error}</p>}
    </section>
  );
}
