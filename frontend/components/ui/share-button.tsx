"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";

import { shareLink, shareMessage } from "./share";

const MESSAGE_MS = 2500;

interface Props {
  /** Path to share, e.g. `/posts/123`; resolved against the current origin. */
  path: string;
  title: string;
  /** Bordered variant, for use inside cards. */
  outline?: boolean;
}

/** Icon button that shares a request, announcing "Link copied" politely. */
export function ShareButton({ path, title, outline = false }: Props) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onShare() {
    const outcome = await shareLink({ url: window.location.origin + path, title });
    const text = shareMessage(outcome);
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    if (text) timer.current = setTimeout(() => setMessage(""), MESSAGE_MS);
  }

  return (
    <span className="share">
      <button
        type="button"
        className={outline ? "icon-btn icon-btn--outline" : "icon-btn"}
        aria-label="Share request"
        onClick={() => void onShare()}
      >
        <Share2 size={18} aria-hidden="true" />
      </button>
      <span className="share__status" role="status" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
