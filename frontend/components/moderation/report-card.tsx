"use client";

import Link from "next/link";
import { useId } from "react";

import { AiTriagePanel } from "@/components/moderation/ai-triage-panel";
import { InlineActionForm } from "@/components/moderation/inline-action-form";
import { relativeTime } from "@/lib/format";
import { reasonMeta } from "@/lib/ui/moderation-meta";
import type { ModerationActionType, ReportResponse } from "@/lib/types/api";

const TARGETS: Record<string, string> = {
  post: "Post",
  comment: "Comment",
  message: "Message",
  user: "Member",
};

const STATUSES: Record<string, string> = {
  pending: "Pending",
  reviewing: "In review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

function ShortId({ id }: { id: string }) {
  return (
    <code className="report-card__id" title={id}>
      {id.slice(0, 8)}
    </code>
  );
}

interface Props {
  token: string;
  report: ReportResponse;
  triageEnabled: boolean;
  onUrgent: (reportId: string) => void;
  onAct: (
    reportId: string,
    targetUserId: string,
    action: ModerationActionType,
    reason: string,
    durationHours?: number,
  ) => Promise<void>;
  acting: boolean;
}

/** One member report: what was reported, why, and the tools to act on it. */
export function ReportCard({ token, report, triageEnabled, onUrgent, onAct, acting }: Props) {
  const titleId = useId();
  const reason = reasonMeta(report.reason);
  const target = TARGETS[report.target_type] ?? report.target_type;

  return (
    <article className="report-card" aria-labelledby={titleId}>
      <header className="report-card__head">
        <span className={`mod-badge mod-tone--${reason.tone}`}>
          <reason.Icon size={14} strokeWidth={2.25} aria-hidden="true" />
          {reason.label}
        </span>
        <h3 id={titleId} className="report-card__title">
          Reported {target.toLowerCase()}
        </h3>
        <time className="report-card__time" dateTime={report.created_at}>
          {relativeTime(report.created_at)}
        </time>
        <span className={`report-status report-status--${report.status}`}>
          {STATUSES[report.status] ?? report.status}
        </span>
      </header>

      {report.description ? (
        <blockquote className="report-card__note">
          <p>{report.description}</p>
        </blockquote>
      ) : (
        <p className="report-card__empty">The reporter added no details.</p>
      )}

      <dl className="report-card__facts">
        <div>
          <dt>{target}</dt>
          <dd>
            {report.target_type === "post" ? (
              <Link href={`/posts/${report.target_id}`}>Open post</Link>
            ) : (
              <ShortId id={report.target_id} />
            )}
          </dd>
        </div>
        <div>
          <dt>Reporter</dt>
          <dd>
            <ShortId id={report.reporter_id} />
          </dd>
        </div>
      </dl>

      {triageEnabled ? <AiTriagePanel token={token} report={report} onUrgent={onUrgent} /> : null}

      {report.status === "pending" ? (
        <InlineActionForm report={report} onSubmit={onAct} acting={acting} />
      ) : null}
    </article>
  );
}
