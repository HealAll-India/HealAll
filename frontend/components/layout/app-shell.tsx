"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { logout } from "@/lib/api/auth";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";

const BASE_LINKS = [
  { href: "/feed",      label: "Feed" },
  { href: "/posts/new", label: "New Post" },
  { href: "/verify",    label: "Vote" },
  { href: "/cases",     label: "Cases" },
  { href: "/messages",  label: "Messages" },
  { href: "/profile",   label: "Profile" },
];

const MOD_LINKS = [
  { href: "/admin/moderation", label: "Moderation" },
];

const VERIFIER_LINKS = [
  { href: "/admin/verification", label: "Verify" },
];

const ADMIN_LINKS = [
  { href: "/invites", label: "Invites" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated  = useHydrated();
  const pathname  = usePathname();
  const router    = useRouter();
  const { accessToken, user, clearSession } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeDrawer = () => setMobileNavOpen(false);
  const burgerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  const isAuthed = hydrated && Boolean(accessToken);
  const roles      = user?.roles ?? [];
  const isMod      = roles.some(r => ["moderator", "admin", "head_admin"].includes(r));
  const isAdmin    = roles.some(r => ["admin", "head_admin"].includes(r));
  const isVerifier = roles.some(r => ["case_verifier", "admin", "head_admin"].includes(r));

  const visibleLinks = [
    ...BASE_LINKS,
    ...(isMod      ? MOD_LINKS      : []),
    ...(isVerifier ? VERIFIER_LINKS : []),
    ...(isAdmin    ? ADMIN_LINKS    : []),
  ];

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

  // Lock body scroll, trap focus inside the drawer, and restore focus to the
  // burger on close. Without this, keyboard users could tab back behind the
  // open overlay.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const drawer = drawerRef.current;
    // Move focus to the first focusable element inside the drawer (falls
    // back to the drawer container itself if there is nothing focusable).
    if (drawer) {
      const first = drawer.querySelector<HTMLElement>(focusableSelector);
      (first ?? drawer).focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (e.key !== "Tab" || !drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => el.getAttribute("aria-hidden") !== "true");
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !drawer.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);

    const burger = burgerRef.current;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      // Restore focus to the toggle so keyboard users land back where they
      // opened the menu, not on document.body.
      burger?.focus();
    };
  }, [mobileNavOpen]);

  async function handleLogout() {
    if (accessToken) {
      try { await logout(accessToken); } catch { /* ignore */ }
    }
    clearSession();
    router.push("/login");
  }

  return (
    <>
      <nav className="main-nav">
        <div className="inner">
          <Link href="/" className="logo">
            <div className="logo-mark" aria-hidden="true" />
            <span className="logo-text">HealAll</span>
            <span className="brand-dot" aria-hidden="true" />
          </Link>

          <div className="links">
            {isAuthed ? (
              visibleLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={pathname.startsWith(link.href) ? "active" : ""}
                >
                  {link.label}
                </Link>
              ))
            ) : (
              <>
                <Link href="/signup">Sign up</Link>
                <Link href="/login">Login</Link>
              </>
            )}
          </div>

          <div className="row nav-actions">
            {isAuthed && user ? (
              <>
                <Link href="/posts/new" className="nav-actions__post btn-primary btn-sm nav-actions__post-btn">
                  + Post a Request
                </Link>
                <span className="vpill nav-actions__pill">✓ {user.name} · L{user.verification_level}</span>
                <button className="danger btn-sm nav-actions__logout" onClick={handleLogout} type="button">Logout</button>
              </>
            ) : null}
            <button
              ref={burgerRef}
              type="button"
              className="nav-burger"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-drawer"
              onClick={() => setMobileNavOpen(v => !v)}
            >
              <span aria-hidden="true">{mobileNavOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>
      </nav>

      {mobileNavOpen && (
        <>
          <div
            className="nav-drawer-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            id="mobile-drawer"
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            tabIndex={-1}
          >
            {isAuthed && user ? (
              <div className="nav-drawer__user">
                <span className="vpill">✓ {user.name} · L{user.verification_level}</span>
              </div>
            ) : null}
            <div className="nav-drawer__links">
              {isAuthed ? (
                visibleLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={pathname.startsWith(link.href) ? "active" : ""}
                    onClick={closeDrawer}
                  >
                    {link.label}
                  </Link>
                ))
              ) : (
                <>
                  <Link href="/signup" onClick={closeDrawer}>Sign up</Link>
                  <Link href="/login" onClick={closeDrawer}>Login</Link>
                </>
              )}
            </div>
            {isAuthed && (
              <div className="nav-drawer__actions">
                <Link href="/posts/new" className="nav-drawer__cta" onClick={closeDrawer}>+ Post a Request</Link>
                <button type="button" className="danger btn-sm" onClick={() => { closeDrawer(); handleLogout(); }}>Logout</button>
              </div>
            )}
            <div className="nav-drawer__footer">
              <Link href="/privacy-policy" onClick={closeDrawer}>Privacy</Link>
              <Link href="/terms" onClick={closeDrawer}>Terms</Link>
              <Link href="/contributors" onClick={closeDrawer}>Contributors</Link>
              <Link href="/changelog" onClick={closeDrawer}>Changelog</Link>
            </div>
          </aside>
        </>
      )}

      {children}
      <footer className="app-footer">
        <div className="app-footer__inner">
          <span>© 2026 HealAll</span>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/#community-guidelines">Community Guidelines</Link>
          <Link href="/contributors">Contributors</Link>
          <Link href="/changelog">Changelog</Link>
          <a href="mailto:hello@healallindia.com">Contact</a>
        </div>
      </footer>
    </>
  );
}
