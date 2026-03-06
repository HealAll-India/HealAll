"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { logout } from "@/lib/api/auth";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";

const appLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/posts/new", label: "New Post" },
  { href: "/cases", label: "Cases" },
  { href: "/messages", label: "Messages" },
  { href: "/profile", label: "Profile" },
  { href: "/admin/verification", label: "Verify" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/invites", label: "Invites" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, user, clearSession } = useAuthStore();

  const isAuthed = hydrated && Boolean(accessToken);

  async function handleLogout() {
    if (accessToken) {
      try {
        await logout(accessToken);
      } catch {
        // Ignore server-side logout failure and clear local session anyway.
      }
    }
    clearSession();
    router.push("/login");
  }

  return (
    <>
      <nav className="main-nav">
        <div className="inner">
          <div className="row">
            <Link href="/">
              <strong>HealAll</strong>
            </Link>
            {isAuthed && user ? (
              <span className="badge ok">
                {user.name} · L{user.verification_level}
              </span>
            ) : (
              <span className="badge">Guest</span>
            )}
          </div>

          <div className="links">
            {isAuthed ? (
              appLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    borderColor: pathname.startsWith(link.href) ? "#0f766e" : undefined,
                    color: pathname.startsWith(link.href) ? "#0f766e" : undefined
                  }}
                >
                  {link.label}
                </Link>
              ))
            ) : (
              <>
                <Link href="/signup">Signup</Link>
                <Link href="/verify-otp">Verify OTP</Link>
                <Link href="/login">Login</Link>
              </>
            )}
          </div>

          {isAuthed ? (
            <button className="danger" onClick={handleLogout} type="button">
              Logout
            </button>
          ) : null}
        </div>
      </nav>
      {children}
    </>
  );
}
