import { categoryMeta, urgencyMeta } from "@/lib/ui/post-meta";

/** Category as icon + word on its tone (never colour alone). */
export function CategoryBadge({ category }: { category: string }) {
  const { label, Icon } = categoryMeta(category);
  return (
    <span className={`cat-badge cat-badge--${category}`}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Urgency badge for `high` and `critical` only. Normal and low render
 * nothing, so the badge keeps its meaning (alarm fatigue).
 */
export function UrgencyBadge({ urgency }: { urgency: string }) {
  const meta = urgencyMeta(urgency);
  if (!meta?.badge) return null;
  const { label, Icon } = meta;
  return (
    <span className={`urgency-badge urgency-badge--${meta.value}`}>
      <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
      {label}
    </span>
  );
}
