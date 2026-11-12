"use client";

import { useId } from "react";
import { CircleCheck, CircleX, Clock, MapPin, MessageCircleQuestion } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { CategoryBadge, UrgencyBadge } from "@/components/ui/post-badges";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { relativeTime } from "@/lib/format";
import type { VerificationQueueItem } from "@/lib/types/api";

/** The API refuses shorter notes (`VerificationActionRequest.remarks`). */
export const MIN_NOTE_LENGTH = 5;

export type QueueDecision = "verify" | "request-info" | "reject";

interface Props {
  item: VerificationQueueItem;
  note: string;
  onNoteChange: (value: string) => void;
  onDecide: (decision: QueueDecision) => void;
  acting: boolean;
}

/** A submitted request with everything a verifier needs to decide on it. */
export function QueueCard({ item, note, onNoteChange, onDecide, acting }: Props) {
  const titleId = useId();
  const noteId = useId();
  const hintId = useId();
  const ready = note.trim().length >= MIN_NOTE_LENGTH;
  const disabled = acting || !ready;

  return (
    <article className="queue-card" aria-labelledby={titleId} aria-busy={acting}>
      <header className="queue-card__head">
        <div className="queue-card__badges">
          <CategoryBadge category={item.category} />
          <UrgencyBadge urgency={item.urgency} />
        </div>
        <h2 id={titleId} className="queue-card__title">
          {item.title}
        </h2>
        <div className="meta-row">
          <span className="meta-row__item">
            <MapPin size={15} aria-hidden="true" />
            {item.city}
          </span>
          <span className="meta-row__item">
            <Clock size={15} aria-hidden="true" />
            <span className="sr-only">Submitted </span>
            {relativeTime(item.submitted_at)}
          </span>
        </div>
      </header>

      {item.description ? <p className="queue-card__body">{item.description}</p> : null}

      <div className="queue-card__author">
        <Avatar name={item.author.name} size="sm" />
        <span>
          Asked by <strong>{item.author.name}</strong>
        </span>
        <VerifiedBadge level={item.author.verification_level} />
      </div>

      <div className="queue-card__decide">
        <label htmlFor={noteId}>Note for the record</label>
        <textarea
          id={noteId}
          rows={2}
          maxLength={5000}
          value={note}
          aria-describedby={hintId}
          onChange={(e) => onNoteChange(e.target.value)}
        />
        <p id={hintId} className="queue-card__hint">
          Required for every decision, at least {MIN_NOTE_LENGTH} characters. It&apos;s saved with the decision.
        </p>
        <div className="queue-card__actions">
          <button type="button" disabled={disabled} onClick={() => onDecide("verify")}>
            <CircleCheck size={18} aria-hidden="true" />
            Verify
          </button>
          <button type="button" className="secondary" disabled={disabled} onClick={() => onDecide("request-info")}>
            <MessageCircleQuestion size={18} aria-hidden="true" />
            Ask for more info
          </button>
          <button type="button" className="danger" disabled={disabled} onClick={() => onDecide("reject")}>
            <CircleX size={18} aria-hidden="true" />
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}
