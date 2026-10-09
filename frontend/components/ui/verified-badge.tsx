"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

const LEVELS: Record<number, { label: string; detail: string }> = {
  1: {
    label: "Verified",
    detail: "Phone number and email were confirmed with one-time codes.",
  },
  2: {
    label: "ID verified",
    detail: "Phone, email and a government ID were checked by the HealAll team.",
  },
};

/**
 * Trust badge that explains itself: tapping it says exactly what was
 * checked. Renders nothing for unverified (L0) members.
 */
export function VerifiedBadge({ level }: { level: number }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const popId = useId();
  const info = LEVELS[Math.min(level, 2)];

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!info) return null;

  return (
    <span className="verified" ref={rootRef}>
      <button
        type="button"
        className="verified__btn"
        aria-expanded={open}
        aria-controls={popId}
        onClick={(e) => {
          // Badges often sit inside clickable cards — don't trigger them.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
        {info.label}
      </button>
      {open ? (
        <span id={popId} role="note" className="verified__pop">
          <strong>{info.label}</strong>
          {info.detail}
        </span>
      ) : null}
    </span>
  );
}
