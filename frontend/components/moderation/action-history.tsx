import { relativeTime } from "@/lib/format";
import { actionMeta, durationLabel, untilLabel } from "@/lib/ui/moderation-meta";
import type { ModerationActionResponse } from "@/lib/types/api";

/** Most recent moderation actions, newest first. */
export function ActionHistory({ actions }: { actions: ModerationActionResponse[] }) {
  if (actions.length === 0) {
    return <p className="mod-history__empty">No moderation actions yet.</p>;
  }

  return (
    <ul className="mod-history">
      {actions.map((item) => {
        const meta = actionMeta(item.action);
        return (
          <li key={item.id} className="mod-history__row">
            <span className={`mod-badge mod-tone--${meta.tone}`}>
              <meta.Icon size={14} strokeWidth={2.25} aria-hidden="true" />
              {meta.label}
            </span>
            <span className="mod-history__reason">{item.reason}</span>
            <time className="mod-history__time" dateTime={item.created_at}>
              {relativeTime(item.created_at)}
            </time>
            {item.duration_hours ? (
              <span className="mod-history__term">
                For {durationLabel(item.duration_hours)}
                {item.expires_at ? `, until ${untilLabel(item.expires_at)}` : ""}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
