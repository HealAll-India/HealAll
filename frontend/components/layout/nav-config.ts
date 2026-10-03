import {
  CircleCheck,
  House,
  LayoutDashboard,
  MessageCircle,
  Plus,
  ShieldAlert,
  Ticket,
  User,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/types/api";

export type NavBadgeKey = "verify" | "messages";

export interface NavLink {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: NavBadgeKey;
}

/** Desktop top-bar destinations, in order. */
export const PRIMARY_LINKS: readonly NavLink[] = [
  { href: "/feed", label: "Feed", Icon: House },
  { href: "/verify", label: "Verify", Icon: CircleCheck, badge: "verify" },
  { href: "/cases", label: "Cases", Icon: Users },
  { href: "/messages", label: "Messages", Icon: MessageCircle, badge: "messages" },
];

/** Mobile bottom tab bar: 5 slots with "Ask" in the centre (research: 3–5 tabs, visible beats hidden). */
export const TAB_LINKS: readonly (NavLink & { primary?: boolean })[] = [
  { href: "/feed", label: "Feed", Icon: House },
  { href: "/verify", label: "Verify", Icon: CircleCheck, badge: "verify" },
  { href: "/posts/new", label: "Ask", Icon: Plus, primary: true },
  { href: "/messages", label: "Messages", Icon: MessageCircle, badge: "messages" },
  { href: "/profile", label: "Me", Icon: User },
];

interface RoleLink extends NavLink {
  roles: readonly UserRole[];
}

const ROLE_LINKS: readonly RoleLink[] = [
  { href: "/admin/moderation", label: "Moderation", Icon: ShieldAlert, roles: ["moderator", "admin", "head_admin"] },
  { href: "/admin/verification", label: "Verification queue", Icon: UserCheck, roles: ["case_verifier", "admin", "head_admin"] },
  { href: "/invites", label: "Invites", Icon: Ticket, roles: ["admin", "head_admin"] },
  { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard, roles: ["admin", "head_admin"] },
];

/** Staff tools the given roles may open (same gating the old nav used). */
export function roleLinks(roles: readonly string[]): NavLink[] {
  return ROLE_LINKS.filter((link) => link.roles.some((r) => roles.includes(r))).map(
    ({ href, label, Icon }) => ({ href, label, Icon }),
  );
}

/**
 * Full-screen flows with their own sticky action bar — the tab bar would
 * cover it, so it's hidden there.
 */
export function isTabBarHidden(pathname: string): boolean {
  return pathname === "/posts/new" || /^\/messages\/[^/]+\/?$/.test(pathname);
}

/** `/posts/123` is "inside" Feed; `/messages/abc` is inside Messages. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/feed") {
    return pathname === "/feed" || (pathname.startsWith("/posts/") && pathname !== "/posts/new");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
