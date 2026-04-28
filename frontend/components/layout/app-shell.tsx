"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { logout } from "@/lib/api/auth";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";

const BASE_LINKS = [
  { href: "/feed",      label: "Feed" },
  { href: "/posts/new", label: "New Post" },
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="HealAll" width={36} height={36} />
            <span className="logo-text">HealAll</span>
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

          <div className="row" style={{ gap: "10px" }}>
            {isAuthed && user ? (
              <>
                <span className="vbadge">{user.name} · L{user.verification_level}</span>
                <button className="danger" onClick={handleLogout} type="button">Logout</button>
              </>
            ) : null}
          </div>
        </div>
      </nav>
      {children}
      <footer style={{ borderTop: "1px solid #e5e7eb", padding: "20px 24px", marginTop: "auto" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap", fontSize: "13px", color: "#9ca3af" }}>
          <span>© 2026 HealAll</span>
          <Link href="/privacy-policy" style={{ color: "#6b7280" }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: "#6b7280" }}>Terms of Service</Link>
          <Link href="/#community-guidelines" style={{ color: "#6b7280" }}>Community Guidelines</Link>
          <a href="mailto:hello@healallindia.com" style={{ color: "#6b7280" }}>Contact</a>
        </div>
      </footer>
    </>
  );
}
