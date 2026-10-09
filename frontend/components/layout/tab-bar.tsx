import Link from "next/link";

import { NAV_BADGE_SR, TAB_LINKS, isActive, type NavBadgeKey } from "./nav-config";

interface Props {
  pathname: string;
  badges: Partial<Record<NavBadgeKey, number | null>>;
}

/** Mobile bottom navigation (hidden ≥ 900px by CSS). */
export function TabBar({ pathname, badges }: Props) {
  return (
    <nav className="tabbar" aria-label="Primary">
      {TAB_LINKS.map(({ href, label, Icon, badge, primary }) => {
        const active = !primary && isActive(pathname, href);
        const count = badge ? badges[badge] : null;
        return (
          <Link
            key={href}
            href={href}
            className={`tabbar__item${primary ? " tabbar__item--primary" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="tabbar__icon">
              <Icon size={primary ? 22 : 24} strokeWidth={active || primary ? 2.25 : 2} aria-hidden="true" />
              {count ? <span className="nav-count tabbar__count">{count > 99 ? "99+" : count}</span> : null}
            </span>
            <span className="tabbar__label">
              {label}
              {count && badge ? <span className="sr-only">, {count} {NAV_BADGE_SR[badge]}</span> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
