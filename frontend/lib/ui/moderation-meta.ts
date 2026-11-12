/**
 * Labels, icons and tones for report reasons and moderation actions.
 * Keys are the backend's wire values (`app/models/report.py`). Tones map to `.mod-tone--{tone}` in
 * `app/styles/admin.css`, so colour always travels with an icon and a word.
 */
import {
  Ban,
  CircleSlash,
  Flag,
  HandCoins,
  LifeBuoy,
  MailWarning,
  MessageSquareWarning,
  Timer,
  TriangleAlert,
  UserLock,
  type LucideIcon,
} from "lucide-react";

import { humanize } from "@/lib/ui/post-meta";

export type ModTone = "neutral" | "info" | "warning" | "danger";

export interface ModMeta {
  label: string;
  Icon: LucideIcon;
  tone: ModTone;
}

const REASONS: Record<string, ModMeta> = {
  crisis: { label: "Crisis", Icon: LifeBuoy, tone: "danger" },
  harassment: { label: "Harassment", Icon: MessageSquareWarning, tone: "danger" },
  fraud: { label: "Fraud", Icon: TriangleAlert, tone: "warning" },
  solicitation: { label: "Solicitation", Icon: HandCoins, tone: "info" },
  spam: { label: "Spam", Icon: MailWarning, tone: "neutral" },
  other: { label: "Other", Icon: Flag, tone: "neutral" },
};

const ACTIONS: Record<string, ModMeta & { done: string }> = {
  warn: { label: "Warning", Icon: TriangleAlert, tone: "warning", done: "Warning sent." },
  restrict: { label: "Restricted", Icon: UserLock, tone: "info", done: "Member restricted." },
  suspend: { label: "Suspended", Icon: Timer, tone: "danger", done: "Member suspended." },
  ban: { label: "Banned", Icon: Ban, tone: "danger", done: "Member banned." },
  dismiss: { label: "Dismissed", Icon: CircleSlash, tone: "neutral", done: "Report dismissed." },
};

/** Report reason; unknown values degrade to a neutral flag. */
export function reasonMeta(reason: string): ModMeta {
  return REASONS[reason] ?? { label: humanize(reason), Icon: Flag, tone: "neutral" };
}

/** Moderation action; unknown values degrade to a neutral flag. */
export function actionMeta(action: string): ModMeta & { done: string } {
  return ACTIONS[action] ?? { label: humanize(action), Icon: Flag, tone: "neutral", done: "Action applied." };
}

/** Suspension length: "12 hours", "1 day", "7 days". */
export function durationLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** When a time-limited action ends: "14 Nov, 3:00 pm". */
export function untilLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
