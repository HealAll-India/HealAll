# Design System Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the HealAll design system across all frontend pages: role-gated nav with gradient logo, Instagram-style feed with category bubbles + sidebar, polished auth pages, and post pages with real copy.

**Architecture:** Extract 3 focused feed components (`CategoryBubbles`, `FeedCard`, `FeedSidebar`) under `components/feed/`; edit all other pages in-place. All styling uses CSS custom properties already defined in `globals.css` — no new CSS files needed. No frontend test infrastructure exists, so TypeScript compilation (`npm run build`) is used as verification.

**Tech Stack:** Next.js 15 App Router, TypeScript, vanilla CSS (`globals.css` tokens), no Tailwind, no component library.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `frontend/public/logo.jpeg` | Copy from `assets/logo.jpeg` — served as `/logo.jpeg` |
| Modify | `frontend/lib/types/api.ts` | Export `FeedFilters` type (moved from feed page) |
| Modify | `frontend/components/layout/app-shell.tsx` | Gradient logo, role-gated nav, fix teal inline style |
| Create | `frontend/components/feed/category-bubbles.tsx` | 7 category filter bubbles |
| Create | `frontend/components/feed/feed-card.tsx` | Single post card component |
| Create | `frontend/components/feed/feed-sidebar.tsx` | Filters + stats + recent authors |
| Modify | `frontend/app/feed/page.tsx` | Wire up 3 new components, 2-column layout |
| Modify | `frontend/app/login/page.tsx` | Real copy, logo, footer link |
| Modify | `frontend/app/signup/page.tsx` | Real copy, logo, invite note |
| Modify | `frontend/app/verify-otp/page.tsx` | Real copy, logo, split 6-box OTP |
| Modify | `frontend/app/posts/new/page.tsx` | Real copy, emoji categories |
| Modify | `frontend/app/posts/[postId]/page.tsx` | Feed-card style header, back link, no "Module X" |

---

## Task 1: Logo + AppShell nav

**Files:**
- Create: `frontend/public/logo.jpeg` (copy from `assets/logo.jpeg`)
- Modify: `frontend/components/layout/app-shell.tsx`

- [ ] **Step 1: Copy logo to Next.js public dir**

```bash
cp assets/logo.jpeg frontend/public/logo.jpeg
```

- [ ] **Step 2: Replace AppShell with role-gated nav + gradient logo**

Full replacement of `frontend/components/layout/app-shell.tsx`:

```tsx
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

const ADMIN_LINKS = [
  { href: "/admin/verification", label: "Verify" },
  { href: "/invites",            label: "Invites" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated  = useHydrated();
  const pathname  = usePathname();
  const router    = useRouter();
  const { accessToken, user, clearSession } = useAuthStore();

  const isAuthed = hydrated && Boolean(accessToken);
  const roles    = user?.roles ?? [];
  const isMod    = roles.some(r => ["MODERATOR", "ADMIN", "HEAD_ADMIN"].includes(r));
  const isAdmin  = roles.some(r => ["ADMIN", "HEAD_ADMIN"].includes(r));

  const visibleLinks = [
    ...BASE_LINKS,
    ...(isMod   ? MOD_LINKS   : []),
    ...(isAdmin ? ADMIN_LINKS : []),
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
    </>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors referencing `app-shell.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/logo.jpeg frontend/components/layout/app-shell.tsx
git commit -m "feat: role-gated nav with gradient logo wordmark, fix teal inline style"
```

---

## Task 2: Export FeedFilters type

**Files:**
- Modify: `frontend/lib/types/api.ts` (add export at bottom of file)

- [ ] **Step 1: Add FeedFilters to api.ts**

Append to the end of `frontend/lib/types/api.ts`:

```ts
export interface FeedFilters {
  city:     string;
  category: string;
  urgency:  string;
  search:   string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/types/api.ts
git commit -m "feat: export FeedFilters type from api.ts"
```

---

## Task 3: CategoryBubbles component

**Files:**
- Create: `frontend/components/feed/category-bubbles.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

interface Bubble {
  value:   string;
  emoji:   string;
  label:   string;
  color:   string;
  bg:      string;
  border:  string;
}

const BUBBLES: Bubble[] = [
  { value: "",                 emoji: "💚", label: "All",        color: "transparent",          bg: "linear-gradient(135deg,#16a34a,#2563eb)", border: "transparent" },
  { value: "urgent",           emoji: "🆘", label: "Urgent",     color: "#e11d48",               bg: "#fff1f2",                                  border: "#e11d48"     },
  { value: "emotional_support",emoji: "🤗", label: "Support",    color: "#f59e0b",               bg: "#fef3c7",                                  border: "#f59e0b"     },
  { value: "mentorship",       emoji: "🎓", label: "Mentorship", color: "#2563eb",               bg: "#eff6ff",                                  border: "#2563eb"     },
  { value: "skill_sharing",    emoji: "🔧", label: "Skills",     color: "#16a34a",               bg: "#f0fdf4",                                  border: "#16a34a"     },
  { value: "navigation",       emoji: "🧭", label: "Navigate",   color: "#7c3aed",               bg: "#faf5ff",                                  border: "#7c3aed"     },
  { value: "on_ground",        emoji: "🤝", label: "On Ground",  color: "#d97706",               bg: "#fffbeb",                                  border: "#d97706"     },
];

interface Props {
  active:   string;
  onChange: (category: string) => void;
}

export function CategoryBubbles({ active, onChange }: Props) {
  return (
    <div style={{
      display: "flex", gap: "14px", overflowX: "auto", padding: "16px",
      background: "#fff", borderRadius: "20px",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: "20px",
      scrollbarWidth: "none",
    }}>
      {BUBBLES.map(b => {
        const isActive = b.value === active;
        const isAll    = b.value === "";
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "5px", background: "transparent", border: "none",
              cursor: "pointer", flexShrink: 0, padding: 0,
            }}
          >
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: isAll ? b.bg : b.bg,
              border: `${isActive ? "3px" : "2px"} solid ${isActive ? b.border : "transparent"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isAll ? "20px" : "24px",
              transform: isActive ? "scale(1.08)" : "scale(1)",
              transition: "transform 0.12s",
              boxShadow: isActive ? `0 0 0 3px ${isAll ? "rgba(22,163,74,0.2)" : b.border + "33"}` : "none",
            }}>
              {b.emoji}
            </div>
            <span style={{
              fontSize: "10px", fontWeight: 700,
              color: isAll
                ? (isActive ? "#16a34a" : "#6b7280")
                : b.color,
            }}>
              {b.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `category-bubbles.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/feed/category-bubbles.tsx
git commit -m "feat: CategoryBubbles component — 7 emoji filter shortcuts"
```

---

## Task 4: FeedCard component

**Files:**
- Create: `frontend/components/feed/feed-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import Link from "next/link";
import type { PostSummary } from "@/lib/types/api";

const CATEGORY_EMOJI: Record<string, string> = {
  urgent:            "🆘",
  emotional_support: "🤗",
  mentorship:        "🎓",
  skill_sharing:     "🔧",
  navigation:        "🧭",
  on_ground:         "🤝",
};

const CATEGORY_BADGE: Record<string, string> = {
  urgent:            "badge badge-urgent",
  emotional_support: "badge",
  mentorship:        "badge",
  skill_sharing:     "badge",
  navigation:        "badge",
  on_ground:         "badge",
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#16a34a,#2563eb)",
  "linear-gradient(135deg,#7c3aed,#2563eb)",
  "linear-gradient(135deg,#d97706,#e11d48)",
  "linear-gradient(135deg,#2563eb,#7c3aed)",
  "linear-gradient(135deg,#16a34a,#d97706)",
];

function avatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

function relativeTime(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1)  return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

interface Props {
  post: PostSummary;
}

export function FeedCard({ post }: Props) {
  const emoji    = CATEGORY_EMOJI[post.category] ?? "📌";
  const badgeCls = CATEGORY_BADGE[post.category] ?? "badge";

  function handleShare() {
    void navigator.clipboard.writeText(window.location.origin + `/posts/${post.id}`);
  }

  return (
    <article className="card stack" style={{ marginBottom: "16px" }}>
      {/* Header */}
      <div className="row" style={{ alignItems: "flex-start", gap: "10px" }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
          background: avatarGradient(post.author.name),
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: "15px",
        }}>
          {post.author.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>
            {post.author.name}
            {post.author.verification_level >= 1 && (
              <span className="vbadge">✓ Verified</span>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "#9ca3af" }}>
            {post.city} · {relativeTime(post.created_at)}
          </div>
        </div>
        <span className={badgeCls}>
          {emoji} {post.category.replace(/_/g, " ")}
        </span>
      </div>

      {/* Photo area */}
      <div style={{
        width: "100%", aspectRatio: "16/9", background: "var(--bg-subtle)",
        borderRadius: "12px", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "48px",
      }}>
        {emoji}
      </div>

      {/* Content */}
      <Link href={`/posts/${post.id}`}>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827", cursor: "pointer" }}>
          {post.title}
        </h3>
      </Link>
      <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>
        {truncate(post.description, 120)}
      </p>

      {/* Actions */}
      <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
        <Link href={`/posts/${post.id}`}>
          <button className="btn-primary" type="button" style={{ fontSize: "13px", padding: "8px 18px" }}>
            Offer Help
          </button>
        </Link>
        <button className="ghost" type="button" onClick={handleShare} style={{ fontSize: "12px" }}>
          ↗ Share
        </button>
        <span style={{ fontSize: "11px", color: "var(--text-subtle)", marginLeft: "auto", alignSelf: "center" }}>
          {post.urgency !== "low" && (
            <span style={{ color: post.urgency === "critical" ? "#e11d48" : "#d97706", fontWeight: 700 }}>
              {post.urgency === "critical" ? "🔴 Critical" : post.urgency === "high" ? "🟡 High urgency" : ""}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `feed-card.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/feed/feed-card.tsx
git commit -m "feat: FeedCard component — avatar, category badge, photo area, actions"
```

---

## Task 5: FeedSidebar component

**Files:**
- Create: `frontend/components/feed/feed-sidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import Link from "next/link";
import type { FeedFilters, FeedResponse } from "@/lib/types/api";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#16a34a,#2563eb)",
  "linear-gradient(135deg,#7c3aed,#2563eb)",
  "linear-gradient(135deg,#d97706,#e11d48)",
];

interface Props {
  feedResult:     FeedResponse | null;
  filters:        FeedFilters;
  onFilterChange: (partial: Partial<FeedFilters>) => void;
}

export function FeedSidebar({ feedResult, filters, onFilterChange }: Props) {
  const items = feedResult?.items ?? [];

  const cities = Array.from(new Set(items.map(p => p.city))).sort();
  const uniqueHelpers = new Set(items.map(p => p.author.id)).size;
  const citiesCount   = new Set(items.map(p => p.city)).size;

  const recentAuthors = Array.from(
    new Map(items.map(p => [p.author.id, p])).values()
  ).slice(0, 3);

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Search + filters */}
      <div className="card stack" style={{ borderRadius: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Search & Filter</h3>
        <input
          value={filters.search}
          onChange={e => onFilterChange({ search: e.target.value })}
          placeholder="Search posts…"
          style={{ fontSize: "12px" }}
        />
        <div className="row" style={{ gap: "6px", flexWrap: "wrap" }}>
          {[
            { label: "All",        value: "" },
            { label: "High urgency", value: "high" },
            { label: "Critical",   value: "critical" },
          ].map(chip => (
            <button
              key={chip.label}
              type="button"
              className={`chip${filters.urgency === chip.value ? " active" : ""}`}
              onClick={() => onFilterChange({ urgency: chip.value })}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <select
          value={filters.city}
          onChange={e => onFilterChange({ city: e.target.value })}
          style={{ fontSize: "12px" }}
        >
          <option value="">All cities</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="card stack" style={{ borderRadius: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Community</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#6b7280" }}>Active posts</span>
          <span style={{ fontWeight: 700, color: "#111827" }}>{feedResult?.total ?? "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#6b7280" }}>Unique helpers</span>
          <span style={{ fontWeight: 700, color: "#16a34a" }}>{uniqueHelpers || "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#6b7280" }}>Cities covered</span>
          <span style={{ fontWeight: 700, color: "#111827" }}>{citiesCount || "—"}</span>
        </div>
      </div>

      {/* Recent authors */}
      {recentAuthors.length > 0 && (
        <div className="card stack" style={{ borderRadius: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Recent helpers</h3>
          {recentAuthors.map((post, i) => (
            <div key={post.author.id} className="row" style={{ gap: "10px", alignItems: "center" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "13px",
              }}>
                {post.author.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {post.author.name}
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>{post.city}</div>
              </div>
              <Link href={`/posts/${post.id}`}>
                <button type="button" className="secondary" style={{ fontSize: "11px", padding: "4px 10px" }}>
                  View
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}

    </aside>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `feed-sidebar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/feed/feed-sidebar.tsx
git commit -m "feat: FeedSidebar — search, urgency chips, city select, stats, recent authors"
```

---

## Task 6: Feed page refactor

**Files:**
- Modify: `frontend/app/feed/page.tsx`

- [ ] **Step 1: Replace feed page**

Full replacement of `frontend/app/feed/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { CategoryBubbles } from "@/components/feed/category-bubbles";
import { FeedCard }        from "@/components/feed/feed-card";
import { FeedSidebar }     from "@/components/feed/feed-sidebar";
import { getFeed }         from "@/lib/api/posts";
import { ApiError }        from "@/lib/api/client";
import { useHydrated }     from "@/lib/hooks/use-hydrated";
import { useAuthStore }    from "@/lib/stores/auth-store";
import type { FeedFilters, FeedResponse } from "@/lib/types/api";
import { AuthRequired }    from "@/components/ui/auth-required";

const INITIAL_FILTERS: FeedFilters = { city: "", category: "", urgency: "", search: "" };

export default function FeedPage() {
  const hydrated = useHydrated();
  const token    = useAuthStore(s => s.accessToken);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<FeedResponse | null>(null);
  const [filters, setFilters] = useState<FeedFilters>(INITIAL_FILTERS);

  async function loadFeed(f: FeedFilters = filters) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getFeed(token, { page: 1, per_page: 20, ...f });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  function applyFilter(partial: Partial<FeedFilters>) {
    const next = { ...filters, ...partial };
    setFilters(next);
    void loadFeed(next);
  }

  useEffect(() => {
    if (token) void loadFeed(INITIAL_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!hydrated) return null;
  if (!token)    return <AuthRequired />;

  return (
    <main>
      <CategoryBubbles
        active={filters.category}
        onChange={cat => applyFilter({ category: cat })}
      />

      {error ? <p className="error" style={{ marginBottom: "12px" }}>{error}</p> : null}
      {loading ? <p className="muted" style={{ marginBottom: "12px" }}>Loading…</p> : null}

      <div className="feed-layout">
        <div>
          {result?.items.map(post => (
            <FeedCard key={post.id} post={post} />
          ))}
          {!loading && result && result.items.length === 0 ? (
            <div className="card">
              <p className="muted">No posts match your filters.</p>
            </div>
          ) : null}
        </div>

        <FeedSidebar
          feedResult={result}
          filters={filters}
          onFilterChange={applyFilter}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/feed/page.tsx
git commit -m "feat: refactor feed page — category bubbles, 2-column layout, sidebar"
```

---

## Task 7: Login page polish

**Files:**
- Modify: `frontend/app/login/page.tsx`

- [ ] **Step 1: Replace JSX return block only (keep all logic)**

Replace the `return (...)` block in `frontend/app/login/page.tsx` with:

```tsx
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "400px", borderRadius: "20px", padding: "36px 32px" }}>

        {/* Logo */}
        <div className="row" style={{ justifyContent: "center", marginBottom: "28px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>Welcome back</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "24px" }}>Sign in with your OTP to continue</p>

        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Phone or Email
            <input
              value={phoneOrEmail}
              onChange={e => setPhoneOrEmail(e.target.value)}
              placeholder="+91 9999999999 or name@email.com"
              required
            />
          </label>
          <label>
            OTP Code
            <input
              value={otpCode}
              onChange={e => setOtpCode(e.target.value)}
              placeholder="6-digit code"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <div className="stack" style={{ gap: "8px", marginTop: "4px" }}>
            <button disabled={loading} type="submit">
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <button className="ghost" disabled={loading} type="button" onClick={handleResendOtp}>
              Resend OTP
            </button>
          </div>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error   ? <p className="error">{error}</p>   : null}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px" }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" style={{ color: "#16a34a", fontWeight: 600 }}>Sign up</a>
        </p>
      </div>
    </main>
  );
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `login/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/login/page.tsx
git commit -m "feat: login page — gradient logo, real copy, centered card, footer link"
```

---

## Task 8: Signup page polish

**Files:**
- Modify: `frontend/app/signup/page.tsx`

- [ ] **Step 1: Replace the return block (keep all state + handlers)**

Replace the `return (...)` block in `frontend/app/signup/page.tsx` with:

```tsx
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "440px", borderRadius: "20px", padding: "36px 32px" }}>

        {/* Logo */}
        <div className="row" style={{ justifyContent: "center", marginBottom: "24px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 4px" }}>Join HealAll</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "16px" }}>India&apos;s mutual-aid community</p>

        {/* Invite note */}
        <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#7c3aed", textAlign: "center", marginBottom: "20px" }}>
          🔒 Invite-only — enter your invite code below
        </div>

        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Invite Code
            <input
              value={formData.invite_code}
              onChange={e => setFormData(prev => ({ ...prev, invite_code: e.target.value }))}
              placeholder="HEAL-XXXXXX"
              required
            />
          </label>
          <label>
            Full Name
            <input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Your name"
              required
            />
          </label>
          <div className="row">
            <label style={{ flex: 1 }}>
              Phone (+91…)
              <input
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+919999999999"
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              Email
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </label>
          </div>
          <div className="row">
            <label style={{ flex: 1 }}>
              City
              <input
                value={formData.city}
                onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              Age Range
              <select
                value={formData.age_range}
                onChange={e => setFormData(prev => ({ ...prev, age_range: e.target.value as SignupRequest["age_range"] }))}
              >
                {ageRanges.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>

          <div style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "12px 14px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#374151", margin: "0 0 10px" }}>I want to…</p>
            <div className="stack" style={{ gap: "6px" }}>
              <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151" }}>
                <input type="checkbox" checked={formData.roles.includes("help_seeker")} onChange={e => setRole("help_seeker", e.target.checked)} />
                Seek help from the community
              </label>
              <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151" }}>
                <input type="checkbox" checked={formData.roles.includes("helper")} onChange={e => setRole("helper", e.target.checked)} />
                Offer help to others
              </label>
            </div>
          </div>

          <button disabled={loading} type="submit" style={{ marginTop: "4px" }}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error   ? <p className="error">{error}</p>   : null}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#16a34a", fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
    </main>
  );
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `signup/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/signup/page.tsx
git commit -m "feat: signup page — logo, invite note, real copy, footer link"
```

---

## Task 9: Verify OTP page — split 6-box input

**Files:**
- Modify: `frontend/app/verify-otp/page.tsx`

- [ ] **Step 1: Replace entire file (logic + UI)**

Full replacement of `frontend/app/verify-otp/page.tsx`:

```tsx
"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { verifyOtp } from "@/lib/api/auth";
import { ApiError }  from "@/lib/api/client";

export default function VerifyOtpPage() {
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [digits,       setDigits]       = useState(["", "", "", "", "", ""]);
  const [loading,      setLoading]      = useState(false);
  const [message,      setMessage]      = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("phone_or_email");
    if (value) setPhoneOrEmail(value);
  }, []);

  function handleDigit(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await verifyOtp({ phone_or_email: phoneOrEmail, otp_code: digits.join("") });
      setMessage(`${res.message} — verification level ${res.verification_level}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  const otpComplete = digits.every(d => d !== "");

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", padding: "2rem 1rem" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: "380px", borderRadius: "20px", padding: "36px 32px" }}>

        {/* Logo */}
        <div className="row" style={{ justifyContent: "center", marginBottom: "28px", gap: "8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="HealAll" width={38} height={38} style={{ borderRadius: "10px" }} />
          <span className="logo-text" style={{ fontSize: "22px" }}>HealAll</span>
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>Verify your number</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "13px", marginBottom: "28px" }}>
          Enter the 6-digit code sent to {phoneOrEmail || "your phone"}
        </p>

        <form onSubmit={handleSubmit}>
          {/* 6-box OTP */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "24px" }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: "46px", height: "54px", textAlign: "center",
                  fontSize: "22px", fontWeight: 700,
                  border: `1.5px solid ${d ? "#16a34a" : "#e5e7eb"}`,
                  borderRadius: "10px",
                  background: d ? "#f0fdf4" : "#f9fafb",
                  color: d ? "#16a34a" : "#111827",
                }}
              />
            ))}
          </div>

          <div className="stack" style={{ gap: "8px" }}>
            <button type="submit" disabled={loading || !otpComplete}>
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={loading}
              onClick={() => setDigits(["", "", "", "", "", ""])}
            >
              Clear
            </button>
          </div>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error   ? <p className="error">{error}</p>   : null}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px" }}>
          Wrong number? <a href="/signup" style={{ color: "#16a34a", fontWeight: 600 }}>Go back</a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `verify-otp/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/verify-otp/page.tsx
git commit -m "feat: verify-otp page — split 6-box OTP input, logo, real copy"
```

---

## Task 10: Posts/new page polish

**Files:**
- Modify: `frontend/app/posts/new/page.tsx`

- [ ] **Step 1: Replace the return block (keep all state + handlers)**

Replace the `return (...)` block in `frontend/app/posts/new/page.tsx` with:

```tsx
  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <div style={{ marginBottom: "4px" }}>
            <a href="/feed" style={{ fontSize: "13px", color: "#6b7280", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              ← Back to feed
            </a>
          </div>
          <section className="card stack">
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Share a Request</h1>
            <p className="muted">Describe what you need — our community will help.</p>
          </section>

          <section className="card">
            <form className="grid" onSubmit={handleSubmit}>

              <div>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>What do you need?</h3>
                <div className="stack">
                  <label>
                    Title
                    <input value={payload.title} onChange={e => setPayload(p => ({ ...p, title: e.target.value }))} placeholder="Brief description of your request" minLength={5} required />
                  </label>
                  <label>
                    Description
                    <textarea value={payload.description} onChange={e => setPayload(p => ({ ...p, description: e.target.value }))} placeholder="Share more details — who it&apos;s for, what&apos;s needed, timeline…" minLength={20} required />
                  </label>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Details</h3>
                <div className="row">
                  <label style={{ flex: 1 }}>
                    Category
                    <select value={payload.category} onChange={e => setPayload(p => ({ ...p, category: e.target.value as CreatePostPayload["category"] }))}>
                      <option value="urgent">🆘 Urgent</option>
                      <option value="emotional_support">🤗 Emotional Support</option>
                      <option value="mentorship">🎓 Mentorship</option>
                      <option value="skill_sharing">🔧 Skill Sharing</option>
                      <option value="navigation">🧭 Navigation Help</option>
                      <option value="on_ground">🤝 On Ground</option>
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>
                    Urgency
                    <select value={payload.urgency} onChange={e => setPayload(p => ({ ...p, urgency: e.target.value as CreatePostPayload["urgency"] }))}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">🟡 High</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </label>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Location</h3>
                <label>
                  City
                  <input value={payload.city} onChange={e => setPayload(p => ({ ...p, city: e.target.value }))} placeholder="Which city?" required />
                </label>
              </div>

              <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <input type="checkbox" checked={submitNow} onChange={e => setSubmitNow(e.target.checked)} />
                Submit immediately for community review
              </label>

              <button disabled={loading} type="submit">
                {loading ? "Saving…" : "Post Request"}
              </button>
            </form>
            {message ? <p className="success">{message}</p> : null}
            {error   ? <p className="error">{error}</p>   : null}
          </section>
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `posts/new/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/posts/new/page.tsx
git commit -m "feat: posts/new page — real copy, emoji categories, section headers"
```

---

## Task 11: Posts/[postId] page polish

**Files:**
- Modify: `frontend/app/posts/[postId]/page.tsx`

- [ ] **Step 1: Replace the return block (keep all state + handlers)**

Replace the `return (...)` block in `frontend/app/posts/[postId]/page.tsx` with:

```tsx
  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <div>
            <a href="/feed" style={{ fontSize: "13px", color: "#6b7280", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              ← Back to feed
            </a>
          </div>

          {loading ? <p className="muted">Loading…</p> : null}

          {post ? (
            <>
              {/* Post card */}
              <section className="card stack">
                {/* Header */}
                <div className="row" style={{ alignItems: "flex-start", gap: "10px" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#16a34a,#2563eb)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: "16px",
                  }}>
                    {post.author.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
                      {post.author.name}
                      {post.author.verification_level >= 1 && <span className="vbadge">✓ Verified</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                      {post.city} · L{post.author.verification_level}
                    </div>
                  </div>
                  <span className="badge badge-urgent">{post.category.replace(/_/g, " ")}</span>
                  <span className={`badge${post.urgency === "critical" ? " badge-urgent" : ""}`}>{post.urgency}</span>
                </div>

                {/* Body */}
                <h2 style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 800 }}>{post.title}</h2>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{post.description}</p>

                {/* Actions */}
                <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                  <button className="secondary" onClick={handleRequestDmConsent} type="button">
                    💬 Send Message
                  </button>
                  <span className="badge" style={{ background: "#f9fafb", color: "#6b7280" }}>{post.status}</span>
                </div>
              </section>

              {/* Comments */}
              <section className="card stack">
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Comments</h3>
                <form className="row" onSubmit={handleCreateComment}>
                  <input value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Write a public comment…" style={{ flex: 1 }} />
                  <button type="submit">Post</button>
                </form>
                <div className="stack">
                  {comments.map(comment => (
                    <article className="card" key={comment.id} style={{ padding: "12px 14px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "13px" }}>{comment.body}</p>
                      <p className="muted" style={{ fontSize: "11px" }}>
                        {comment.author.name} · L{comment.author.verification_level}
                      </p>
                    </article>
                  ))}
                  {!loading && comments.length === 0 ? <p className="muted">No comments yet.</p> : null}
                </div>
              </section>

              {/* Report */}
              <section className="card stack">
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#6b7280" }}>Report this post</h3>
                <form className="grid" onSubmit={handleReport}>
                  <label>
                    Reason
                    <select value={reportReason} onChange={e => setReportReason(e.target.value as ReportReason)}>
                      {reportReasons.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label>
                    Description (optional)
                    <textarea value={reportDescription} onChange={e => setReportDescription(e.target.value)} placeholder="Additional context" />
                  </label>
                  <button className="ghost" type="submit" style={{ width: "fit-content" }}>Submit Report</button>
                </form>
              </section>
            </>
          ) : null}

          {message ? <p className="success">{message}</p> : null}
          {error   ? <p className="error">{error}</p>   : null}
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/posts/[postId]/page.tsx
git commit -m "feat: post detail page — feed-card header, back link, no Module labels"
```

---

## Task 12: Verify dev server visually

- [ ] **Step 1: Start dev server**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000. Check:

| Page | What to verify |
|---|---|
| `/login` | Centered card, logo, gradient sign-in button |
| `/signup` | Purple invite note visible, logo, checkboxes |
| `/verify-otp` | 6 individual boxes, auto-advance on digit |
| `/feed` | Category bubbles row, 2-col layout, sidebar visible |
| `/feed` | Click a bubble → feed reloads filtered |
| `/feed` | Sidebar urgency chips work |
| `/posts/new` | "Share a Request" heading, emoji in dropdowns |
| Nav | Gradient "HealAll" wordmark, logo image |
| Nav | Active link is green, not teal |

- [ ] **Step 2: Write activity log**

Append to `docs/ACTIVITY_LOG.md`:

```markdown
## 2026-04-21 — Design system rollout
**Agent**: coder (claude-sonnet-4-6)
**Scope**: Apply HealAll design system across all frontend pages
**Changes**:
- `frontend/public/logo.jpeg`: copied from assets/ for Next.js serving
- `frontend/lib/types/api.ts`: exported FeedFilters interface
- `frontend/components/layout/app-shell.tsx`: gradient logo, role-gated links, removed teal inline style
- `frontend/components/feed/category-bubbles.tsx`: new — 7 emoji filter bubbles mapping to backend category values
- `frontend/components/feed/feed-card.tsx`: new — post card with avatar, category badge, photo area, share action
- `frontend/components/feed/feed-sidebar.tsx`: new — search, urgency chips, city select, stats from feed response, recent authors
- `frontend/app/feed/page.tsx`: refactored to 2-column layout using 3 new components
- `frontend/app/login/page.tsx`: centered card, logo, "Welcome back" copy
- `frontend/app/signup/page.tsx`: logo, invite note, real copy
- `frontend/app/verify-otp/page.tsx`: split 6-box OTP input with auto-focus
- `frontend/app/posts/new/page.tsx`: "Share a Request" copy, emoji categories
- `frontend/app/posts/[postId]/page.tsx`: feed-card style header, back link
**Tests**: TypeScript build passes. Visual check via npm run dev.
**Follow-ups**: Upload frontend wiring (presigned URL routes). Other pages (cases, messages, admin, profile) still use old layout.
```

- [ ] **Step 3: Final commit**

```bash
git add docs/ACTIVITY_LOG.md
git commit -m "docs: activity log for design system rollout"
```
