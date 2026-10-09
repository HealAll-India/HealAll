import type { LucideIcon } from "lucide-react";

interface Props {
  Icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

/** Friendly "nothing here yet" panel with an optional next step. */
export function EmptyState({ Icon, title, children, action }: Props) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon size={24} strokeWidth={2} />
      </span>
      <h2 className="empty-state__title">{title}</h2>
      {children ? <p className="empty-state__body">{children}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}
