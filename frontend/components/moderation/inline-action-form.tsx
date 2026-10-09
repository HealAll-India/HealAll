"use client";

import { useState } from "react";

import { moderationActions } from "@/lib/constants";
import type { ModerationActionType, ReportResponse } from "@/lib/types/api";

interface InlineActionFormProps {
  report: ReportResponse;
  /** `targetUserId` is "" unless the moderator overrides it; the API then acts on the reported member. */
  onSubmit: (reportId: string, targetUserId: string, action: ModerationActionType, reason: string, durationHours?: number) => Promise<void>;
  acting: boolean;
}

/**
 * Collapsed "Take action" control for one report. By default the action
 * lands on the member who was reported — the API resolves them from the
 * report (post/comment/message author, or the reported user). It must
 * never default to the reporter.
 */
export function InlineActionForm({ report, onSubmit, acting }: InlineActionFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<ModerationActionType>("warn");
  const [reason, setReason] = useState(`Report reviewed: ${report.reason}`);
  const [targetUserId, setTargetUserId] = useState("");
  const [durationHours, setDurationHours] = useState<number | "">("");

  if (!expanded) {
    return (
      <button
        className="ghost btn-sm"
        type="button"
        onClick={() => setExpanded(true)}
      >
        Take action →
      </button>
    );
  }

  return (
    <div className="mod-action">
      <div className="mod-action__grid">
        <label>
          Action
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as ModerationActionType)}
          >
            {moderationActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Different member ID (optional)
          <input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="Defaults to the reported member"
          />
        </label>
      </div>
      <label>
        Reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
      </label>
      {(action === "suspend" || action === "restrict") && (
        <label>
          Duration (hours)
          <input
            type="number"
            min={1}
            max={8760}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value ? Number(e.target.value) : "")}
          />
        </label>
      )}
      <div className="mod-action__buttons">
        <button
          type="button"
          className="btn-sm"
          disabled={acting || !reason.trim()}
          onClick={() =>
            void onSubmit(
              report.id,
              targetUserId.trim(),
              action,
              reason,
              durationHours === "" ? undefined : durationHours
            )
          }
        >
          Confirm
        </button>
        <button
          className="ghost btn-sm"
          type="button"
          onClick={() => setExpanded(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
