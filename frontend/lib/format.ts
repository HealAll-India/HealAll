/**
 * Locale-aware formatting for the UI. India-first: `en-IN` gives lakh/crore
 * grouping ("1,20,000") and compact forms ("1.2L").
 */

const LOCALE = "en-IN";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact relative time for feeds and lists: "Just now", "5m ago",
 * "3h ago", "2d ago", then a short date ("12 Sept"). Future timestamps
 * (clock skew) read as "Just now".
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = now - then;
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
  return new Date(then).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Clock time for chat bubbles: "2:40 pm". */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
}

/** Compact counts: 950 → "950", 12_400 → "12.4K", 1_20_000 → "1.2L". */
export function formatCount(n: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** "1 helper" / "3 helpers". */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
