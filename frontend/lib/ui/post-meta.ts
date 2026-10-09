/**
 * Single source of truth for how post categories, urgencies and statuses
 * (and case statuses) are labelled, iconised and toned across the UI.
 *
 * Keys are the backend's wire values (`app/models/post.py`,
 * `app/models/case.py`). Tones map to CSS classes in
 * `app/styles/primitives.css` (`.cat-badge--{value}`, `.cat-tone--{value}`,
 * `.urgency-badge--{value}`), so colour always travels with an icon and a
 * word — never colour alone.
 */
import {
  CircleCheck,
  CircleDashed,
  Clock,
  Compass,
  Droplet,
  FileText,
  GraduationCap,
  HandHelping,
  HeartHandshake,
  Info,
  TriangleAlert,
  Ban,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { postCategories, postUrgencies } from "@/lib/constants";

export type PostCategory = (typeof postCategories)[number];
export type PostUrgency = (typeof postUrgencies)[number];

export interface CategoryMeta {
  value: PostCategory;
  /** Short label for chips and badges. */
  label: string;
  /** One-line description for pickers ("what counts as this?"). */
  hint: string;
  Icon: LucideIcon;
}

/** Display order: the order members see in filters and the post picker. */
export const CATEGORIES: readonly CategoryMeta[] = [
  { value: "urgent",            label: "Urgent",     hint: "Blood, medical, emergencies", Icon: Droplet },
  { value: "emotional_support", label: "Support",    hint: "Someone to talk to",          Icon: HeartHandshake },
  { value: "mentorship",        label: "Mentorship", hint: "Guidance from experience",    Icon: GraduationCap },
  { value: "skill_sharing",     label: "Skills",     hint: "Teach or learn something",    Icon: Wrench },
  { value: "navigation",        label: "Navigation", hint: "Forms, offices, paperwork",   Icon: Compass },
  { value: "on_ground",         label: "On-ground",  hint: "Hands-on volunteers",         Icon: HandHelping },
];

const CATEGORY_BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));

/** Metadata for a category; unknown values degrade to a neutral badge. */
export function categoryMeta(value: string): CategoryMeta | { value: string; label: string; hint: string; Icon: LucideIcon } {
  return (
    CATEGORY_BY_VALUE.get(value as PostCategory) ?? {
      value,
      label: humanize(value),
      hint: "",
      Icon: FileText,
    }
  );
}

export interface UrgencyMeta {
  value: PostUrgency;
  label: string;
  /** Explains when to pick this level (shown in the post form). */
  hint: string;
  Icon: LucideIcon;
  /** Only high and critical get a visible badge — avoids alarm fatigue. */
  badge: boolean;
}

export const URGENCIES: readonly UrgencyMeta[] = [
  { value: "low",      label: "Low",      hint: "Whenever someone has time — no deadline.",                              Icon: Clock,         badge: false },
  { value: "normal",   label: "Normal",   hint: "Needed in the next few days.",                                            Icon: Clock,         badge: false },
  { value: "high",     label: "High",     hint: "Needed within a day or two.",                                             Icon: Clock,         badge: true },
  { value: "critical", label: "Critical", hint: "Someone's health or safety is at risk in the next 24 hours.",             Icon: TriangleAlert, badge: true },
];

const URGENCY_BY_VALUE = new Map(URGENCIES.map((u) => [u.value, u]));

export function urgencyMeta(value: string): UrgencyMeta | undefined {
  return URGENCY_BY_VALUE.get(value as PostUrgency);
}

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export interface StatusMeta {
  label: string;
  /** Plain-language explanation of what this status means for the author. */
  description: string;
  tone: StatusTone;
  Icon: LucideIcon;
}

export const POST_STATUS: Record<string, StatusMeta> = {
  draft:      { label: "Draft",                  tone: "neutral", Icon: FileText,     description: "Saved privately. Submit it to start community approval." },
  submitted:  { label: "Awaiting approval",      tone: "warning", Icon: Clock,        description: "Verified members are reviewing it. It appears in the feed once enough of them approve." },
  needs_info: { label: "Needs more information", tone: "warning", Icon: Info,         description: "A reviewer asked for more details. Edit the request and resubmit it." },
  verified:   { label: "Approved",               tone: "success", Icon: CircleCheck,  description: "Approved by the community and about to go live." },
  active:     { label: "Live",                   tone: "success", Icon: CircleCheck,  description: "Visible in the feed. Members can comment and offer help." },
  resolved:   { label: "Resolved",               tone: "neutral", Icon: CircleCheck,  description: "Marked as resolved. Thank you to everyone who helped." },
  rejected:   { label: "Not approved",           tone: "danger",  Icon: Ban,          description: "Reviewers didn't approve this request. Contact support if you think that's a mistake." },
};

export function postStatusMeta(value: string): StatusMeta {
  return POST_STATUS[value] ?? { label: humanize(value), description: "", tone: "neutral", Icon: CircleDashed };
}

/** Case lifecycle — wire values from `CaseStatus` in app/models/case.py. */
export const CASE_STATUS: Record<string, StatusMeta> = {
  active:            { label: "Active",           tone: "info",    Icon: HandHelping,  description: "Helpers are working on this." },
  closure_requested: { label: "Closing",          tone: "warning", Icon: Clock,        description: "Closure has been requested and is awaiting confirmation." },
  closed:            { label: "Closed",           tone: "neutral", Icon: CircleCheck,  description: "This case is closed." },
  reopened:          { label: "Reopened",         tone: "info",    Icon: HandHelping,  description: "This case was reopened after closing." },
};

export function caseStatusMeta(value: string): StatusMeta {
  return CASE_STATUS[value] ?? { label: humanize(value), description: "", tone: "neutral", Icon: CircleDashed };
}

/** "skill_sharing" → "Skill sharing". Replaces every underscore, not just the first. */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ").trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : spaced;
}
