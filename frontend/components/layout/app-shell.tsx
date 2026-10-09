"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { logout } from "@/lib/api/auth";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";

import { AccountMenu } from "./account-menu";
import { NAV_BADGE_SR, PRIMARY_LINKS, isActive, isTabBarHidden, type NavBadgeKey } from "./nav-config";
import { TabBar } from "./tab-bar";
import { useVerifyCount } from "./use-verify-count";

interface Props {
  children: React.ReactNode;
  /**
   * Optional count for the Messages badge (pending message requests). Not
   * wired yet — the inbox API that provides it is landing separately.
   */
  messagesCount?: number | null;
}

export function AppShell({ children, messagesCount = null }: Props) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, user, clearSession } = useAuthStore();

  const isAuthed = hydrated && Boolean(accessToken) && Boolean(user);
  const verifyCount = useVerifyCount(isAuthed ? accessToken : null, user?.verification_level ?? 0, pathname);
  const badges: Partial<Record<NavBadgeKey, number | null>> = { verify: verifyCount, messages: messagesCount };
  const showTabBar = isAuthed && !isTabBarHidden(pathname);

  // Auto-recover from expired/invalid tokens: any 401 from the API client
  // dispatches `auth:expired` — clear session and bounce to /login.
  useEffect(() => {
    function onExpired() {
      if (!useAuthStore.getState().accessToken) return;
      clearSession();
      router.replace("/login?reason=expired");
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [clearSession, router]);

  async function handleSignOut() {
    if (accessToken) {
      try { await logout(accessToken); } catch { /* ignore */ }
    }
    clearSession();
    router.push("/login");
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="topbar">
        <div className="topbar__inner">
          <Link href={isAuthed ? "/feed" : "/"} className="topbar__brand" aria-label="HealAll home">
            <Image src="/heart-mark.png" alt="" width={32} height={32} className="topbar__mark" priority />
            <span className="topbar__wordmark">HealAll</span>
          </Link>

          {isAuthed ? (
            <nav className="topbar__nav" aria-label="Primary">
              {PRIMARY_LINKS.map(({ href, label, badge }) => {
                const active = isActive(pathname, href);
                const count = badge ? badges[badge] : null;
                return (
                  <Link key={href} href={href} className="topbar__link" aria-current={active ? "page" : undefined}>
                    {label}
                    {count && badge ? (
                      <span className="nav-count">
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> {NAV_BADGE_SR[badge]}</span>
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className="topbar__actions">
            {isAuthed && user ? (
              <>
                <Link href="/posts/new" className="btn-primary btn-sm topbar__ask">
                  <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> Ask for help
                </Link>
                <AccountMenu user={user} onSignOut={handleSignOut} />
              </>
            ) : hydrated ? (
              <>
                <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
                <Link href="/signup" className="btn-primary btn-sm">Join</Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div id="main-content" tabIndex={-1} className={showTabBar ? "app-body app-body--tabbar" : "app-body"}>
        {children}
        <footer className="app-footer">
          <div className="app-footer__inner">
            <span className="app-footer__copy">© 2026 HealAll</span>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/#community-guidelines">Community guidelines</Link>
            <Link href="/contributors">Contributors</Link>
            <Link href="/changelog">Changelog</Link>
            <a href="mailto:hello@healallindia.com">Contact</a>
          </div>
        </footer>
      </div>

      {showTabBar ? <TabBar pathname={pathname} badges={badges} /> : null}
    </>
  );
}
