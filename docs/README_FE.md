# HealAll — Frontend Architecture README

> **Version:** 1.0 · **Date:** 16 Feb 2026
> **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · TanStack Query · Zustand
> **Status:** Phase 1 MVP specification (India-first, web-only, invite-only)

---

## 1. Executive Summary

HealAll's frontend is a **web-only** (Phase 1) application that provides an Instagram-like discovery feed backed by a structured case-management lifecycle. Users browse verified help requests, offer help, coordinate through cases, and participate in a consent-gated messaging system — all behind invite-only onboarding and identity verification.

**Key constraints from the product vision:**

- **Trust-first UI:** verification status, badges, and safety warnings must be prominent throughout the experience.
- **Identity-forward:** no pseudonymous posting for help requests. Profiles show real names, cities, and verification levels.
- **Safety by design:** staged communication (comment → consent DM → off-platform only if agreed), crisis content warnings, and reporting at every content surface.
- **India-first:** mobile-first responsive design (most Indian internet users are mobile-web), support for slower 3G/4G connections, minimal JS bundle sizes.
- **No money flows:** the UI must never contain donate buttons, payment forms, or fundraising widgets. Anti-solicitation warnings are shown where relevant.
- **Privacy-default:** contact info is hidden unless the user opts in. Aadhaar data is never visible in the UI (only verification status).
- **Accessibility:** keyboard-navigable, WCAG 2.1 AA compliance, screen-reader friendly.

---

## 2. Stack Choice & Rationale

### Chosen: Next.js 15 (App Router) + TypeScript + Tailwind CSS

| Technology | Why |
| ---------- | --- |
| **Next.js 15 (App Router)** | Server-side rendering for fast initial loads on slow connections (India). App Router gives us React Server Components (less client JS), built-in routing, layouts, and loading states. Incremental Static Regeneration for the public feed page. Excellent DX with hot reload. |
| **TypeScript** | Type safety across the entire frontend. Catches schema drift between FE and BE at compile time. |
| **Tailwind CSS 4** | Utility-first CSS with zero runtime cost. Consistent design system. Easy to build responsive layouts. Small CSS bundle with purging. |
| **TanStack Query v5** | Server-state management: caching, background refetching, optimistic updates, pagination. Avoids reinventing data-fetching. |
| **Zustand** | Lightweight client-state management (auth state, UI state, modals). Simpler than Redux, no boilerplate. |
| **React Hook Form + Zod** | Form handling with schema-based validation. Zod schemas can be shared with backend Pydantic schemas conceptually. |

**Alternatives considered:**

| Alternative | Why not |
| ----------- | ------- |
| Vite + React SPA | No SSR — bad for SEO on the public feed and slow first-load on Indian mobile networks. |
| Remix | Solid framework, but smaller ecosystem and fewer deployment options than Next.js. Worth revisiting if we hit Next.js limitations. |
| SvelteKit | Excellent DX and performance, but smaller hiring pool and component ecosystem. |
| Vue/Nuxt | Viable, but React/Next has a larger ecosystem of accessible component libraries and the team is more familiar with React. |

---

## 3. Folder Structure

```
frontend/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (providers, nav, footer)
│   ├── page.tsx                      # Landing / public feed
│   ├── loading.tsx                   # Global loading fallback
│   ├── error.tsx                     # Global error boundary
│   ├── not-found.tsx                 # 404 page
│   ├── (auth)/                       # Auth route group (no layout chrome)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── verify-otp/page.tsx
│   │   └── layout.tsx               # Minimal layout for auth pages
│   ├── (app)/                        # Authenticated route group
│   │   ├── layout.tsx               # App shell (sidebar, nav, notifications bell)
│   │   ├── feed/page.tsx            # Main feed (discovery)
│   │   ├── posts/
│   │   │   ├── new/page.tsx         # Create help request
│   │   │   └── [postId]/page.tsx    # Post detail + comments
│   │   ├── cases/
│   │   │   ├── page.tsx             # My cases dashboard
│   │   │   └── [caseId]/page.tsx    # Case detail (notes, helpers, timeline)
│   │   ├── messages/
│   │   │   ├── page.tsx             # Conversation list
│   │   │   └── [conversationId]/page.tsx
│   │   ├── profile/
│   │   │   ├── page.tsx             # My profile (view + edit)
│   │   │   └── [userId]/page.tsx    # Public profile view
│   │   ├── notifications/page.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx             # General settings
│   │   │   ├── privacy/page.tsx
│   │   │   └── notifications/page.tsx
│   │   └── identity/page.tsx        # Aadhaar verification upload
│   ├── (admin)/                      # Admin route group
│   │   ├── layout.tsx               # Admin layout with sidebar
│   │   ├── dashboard/page.tsx       # Admin stats
│   │   ├── verification-queue/page.tsx
│   │   ├── moderation/page.tsx
│   │   ├── users/page.tsx           # User management
│   │   ├── announcements/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   └── audit-log/page.tsx
│   └── api/                          # Next.js Route Handlers (BFF, if needed)
│       └── auth/
│           └── [...nextauth]/route.ts  # (if using NextAuth adapter, otherwise skip)
├── components/
│   ├── ui/                           # Design system primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── avatar.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx               # Modal / dialog
│   │   ├── dropdown-menu.tsx
│   │   ├── toast.tsx
│   │   ├── skeleton.tsx             # Loading skeletons
│   │   ├── pagination.tsx
│   │   └── spinner.tsx
│   ├── layout/
│   │   ├── navbar.tsx
│   │   ├── sidebar.tsx
│   │   ├── footer.tsx
│   │   ├── mobile-nav.tsx
│   │   └── notification-bell.tsx
│   ├── feed/
│   │   ├── feed-list.tsx            # Virtualized/paginated feed
│   │   ├── feed-card.tsx            # Single post card in feed
│   │   ├── feed-filters.tsx         # City, category, urgency filters
│   │   └── feed-search.tsx          # Search bar
│   ├── posts/
│   │   ├── post-form.tsx            # Create/edit help request
│   │   ├── post-detail.tsx
│   │   ├── post-status-badge.tsx
│   │   ├── post-media-gallery.tsx
│   │   └── boundary-warning.tsx     # Pre-submission safety warning
│   ├── cases/
│   │   ├── case-dashboard.tsx
│   │   ├── case-timeline.tsx
│   │   ├── case-note-form.tsx
│   │   ├── case-helpers-list.tsx
│   │   ├── case-closure-form.tsx
│   │   └── offer-help-button.tsx
│   ├── comments/
│   │   ├── comment-list.tsx
│   │   └── comment-form.tsx
│   ├── messages/
│   │   ├── conversation-list.tsx
│   │   ├── message-thread.tsx
│   │   ├── dm-consent-dialog.tsx
│   │   └── message-input.tsx
│   ├── moderation/
│   │   ├── report-dialog.tsx
│   │   ├── moderation-queue.tsx
│   │   ├── moderation-action-form.tsx
│   │   └── crisis-banner.tsx        # Auto-shown when crisis keywords detected
│   ├── verification/
│   │   ├── verification-queue-list.tsx
│   │   ├── verification-action-form.tsx
│   │   └── identity-upload-form.tsx  # Aadhaar upload with consent
│   ├── profile/
│   │   ├── profile-card.tsx
│   │   ├── profile-edit-form.tsx
│   │   ├── skills-editor.tsx
│   │   ├── badges-display.tsx
│   │   └── verification-badge.tsx   # Level 0-3 indicator
│   ├── announcements/
│   │   ├── announcement-card.tsx
│   │   └── announcement-form.tsx
│   └── shared/
│       ├── empty-state.tsx
│       ├── error-message.tsx
│       ├── confirm-dialog.tsx
│       ├── safe-messaging-tip.tsx   # "Start public, move private with consent"
│       └── crisis-resources.tsx     # Emergency numbers (112, iCall, Vandrevala)
├── lib/
│   ├── api/
│   │   ├── client.ts               # Axios/fetch wrapper with auth interceptor
│   │   ├── auth.ts                  # Signup, login, OTP, token refresh
│   │   ├── users.ts                 # Profile API calls
│   │   ├── posts.ts                 # Post CRUD + feed
│   │   ├── cases.ts                 # Case API calls
│   │   ├── comments.ts
│   │   ├── messages.ts
│   │   ├── moderation.ts
│   │   ├── verification.ts
│   │   ├── notifications.ts
│   │   ├── announcements.ts
│   │   ├── badges.ts
│   │   └── admin.ts
│   ├── hooks/
│   │   ├── use-auth.ts              # Auth state hook (Zustand)
│   │   ├── use-feed.ts              # TanStack Query hook for feed
│   │   ├── use-post.ts
│   │   ├── use-case.ts
│   │   ├── use-notifications.ts
│   │   ├── use-messages.ts
│   │   └── use-debounce.ts
│   ├── stores/
│   │   ├── auth-store.ts            # Zustand: user, tokens, roles
│   │   ├── ui-store.ts              # Zustand: sidebar open, modals, toasts
│   │   └── notification-store.ts    # Zustand: unread count (synced with server)
│   ├── utils/
│   │   ├── cn.ts                    # clsx + tailwind-merge utility
│   │   ├── format-date.ts           # IST-aware date formatting
│   │   ├── validation.ts            # Zod schemas (shared with forms)
│   │   └── constants.ts             # Categories, urgency levels, role labels
│   └── types/
│       ├── api.ts                   # API response types (mirrors backend schemas)
│       ├── user.ts
│       ├── post.ts
│       ├── case.ts
│       └── common.ts               # Pagination, error response types
├── styles/
│   └── globals.css                  # Tailwind directives + custom CSS vars
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── crisis-resources.json        # Emergency numbers by region
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   └── utils/
│   ├── integration/
│   │   └── pages/
│   └── e2e/
│       ├── auth.spec.ts
│       ├── feed.spec.ts
│       └── case-lifecycle.spec.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile
├── .env.example
└── .eslintrc.json
```

**File responsibility summary:**

| Layer | Responsibility |
| ----- | -------------- |
| `app/` | Next.js pages and layouts. Each route file is a thin shell that composes components. Server Components where possible, Client Components only when interactivity is needed. |
| `components/ui/` | Design system primitives. Stateless, reusable, accessible. Built on top of Radix UI primitives for accessibility. |
| `components/{domain}/` | Domain-specific components (feed, posts, cases, etc.). Compose UI primitives with business logic. |
| `lib/api/` | API client functions. Each file maps to a backend module. Returns typed responses. |
| `lib/hooks/` | Custom React hooks. Primarily TanStack Query wrappers and Zustand selectors. |
| `lib/stores/` | Zustand stores for client-side state that doesn't come from the server (auth, UI). |
| `lib/types/` | TypeScript types that mirror backend response schemas. |
| `lib/utils/` | Pure utility functions and Zod validation schemas. |

---

## 4. UX Flows & Page Map

### Page Map

```
/                          → Public landing (redirects to /feed if logged in)
/login                     → Phone/email + OTP login
/signup                    → Invite-only registration
/verify-otp                → OTP input screen

/feed                      → Main discovery feed (verified help requests)
/posts/new                 → Create a help request
/posts/[postId]            → Post detail (description, comments, offer help)

/cases                     → My cases dashboard (as seeker, helper, or owner)
/cases/[caseId]            → Case detail (timeline, notes, helpers, closure)

/messages                  → Conversation list
/messages/[conversationId] → Chat thread

/profile                   → My profile (view + edit)
/profile/[userId]          → Public profile

/notifications             → All notifications
/settings                  → General settings
/settings/privacy          → Privacy controls
/settings/notifications    → Notification preferences
/identity                  → Aadhaar verification upload

/admin/dashboard           → Admin stats overview
/admin/verification-queue  → Pending posts for verification
/admin/moderation          → Pending reports + action history
/admin/users               → User search + role management
/admin/announcements       → Manage announcements
/admin/announcements/new   → Create announcement
/admin/audit-log           → Audit trail viewer
```

### Flow 1: Invite-Only Onboarding

```
Landing page → Click "Join" →
  /signup (enter name, phone, email, city, age, invite code, select roles) →
  /verify-otp (enter OTP for phone + email) →
  Accept Terms & Community Guidelines (modal) →
  /identity (optional: upload Aadhaar for Level 2 verification) →
  /feed (start browsing)
```

**Key UI elements:**
- Invite code field with clear error if invalid/expired
- Age range selector (under-18 shows minor safeguard info)
- Role selection: "I want to help", "I need help", or both
- Terms + Community Guidelines must be scrolled to bottom before accepting
- Aadhaar upload: explicit consent checkbox, "Why do we need this?" info tooltip

### Flow 2: Create Help Request

```
/posts/new →
  Fill form: title, description, category, urgency, city, contact prefs →
  Boundary warning modal ("No illegal activity, no solicitation...") →
  Confirm & Submit →
  Post enters "Submitted" status →
  Show confirmation: "Your request is in the verification queue"
```

**Key UI elements:**
- Category picker with descriptions
- Urgency selector (low / normal / high / critical) with color coding
- Optional media upload (drag-and-drop, max 5 files)
- Boundary warning dialog shown before final submission
- Status badge on the post card in "My Posts" view

### Flow 3: Feed & Discovery

```
/feed →
  Filters bar: city dropdown, category chips, urgency toggle, search →
  Scrollable list of post cards (title, category, urgency, city, author, verified badge) →
  Click card → /posts/[postId] →
  Read detail, comments, "Offer Help" button →
  If offering: confirm → joined as case helper
```

**Key UI elements:**
- Feed cards show: title, truncated description, category pill, urgency color, city, author name + verification badge, time ago
- "Offer Help" is a prominent CTA
- Verified badge is always visible (green checkmark)
- Infinite scroll or "Load More" pagination

### Flow 4: Case Dashboard & Coordination

```
/cases →
  Tabs: "As Seeker" | "As Helper" | "As Owner" →
  Case cards showing: linked post title, status, helper count, last activity →
  Click → /cases/[caseId] →
  Timeline view: creation, helper joins, notes, updates, closure →
  Add note form (text + optional attachment + support type + hours) →
  Closure form (if authorized)
```

**Key UI elements:**
- Case timeline (vertical) showing all events chronologically
- Case notes are only visible to the case team
- Closure form with resolution type dropdown and remarks
- Impact story opt-in with consent checkbox

### Flow 5: Consent-Based DMs

```
/posts/[postId] → Click "Message" →
  DM consent dialog ("You're requesting to message [User]. They must accept.") →
  Consent sent → Shows "Pending" status →
  [Other user accepts] →
  /messages/[conversationId] → Chat thread
```

**Key UI elements:**
- "Safe Messaging Tip" banner: "Start with public comments. Move to DMs only with consent."
- Consent request shows context (which post it relates to)
- "Decline" option with 7-day cooldown notice
- Chat thread with text-only messages (no file sharing in MVP)

### Flow 6: Admin — Verification Queue

```
/admin/verification-queue →
  List of submitted posts awaiting review →
  Click → Expanded view with post details + author profile + identity verification status →
  Actions: Verify (with remarks), Request Info, Reject (with reason) →
  On verify: post goes live, case created, seeker notified
```

### Flow 7: Admin — Moderation

```
/admin/moderation →
  Tabs: "Pending Reports" | "Action History" →
  Report card: target content, reporter, reason, description →
  Actions: Warn, Restrict, Suspend (with duration), Ban, Dismiss →
  Confirmation dialog before enforcement →
  User notified of action
```

---

## 5. Component Architecture

### Design System — UI Primitives

We use **Radix UI** (headless, accessible primitives) + **Tailwind CSS** for styling. This gives us accessibility out of the box (focus management, ARIA, keyboard navigation) without fighting a styled component library.

| Component | Built With | Notes |
| --------- | ---------- | ----- |
| `Button` | Native + Tailwind | Variants: primary, secondary, danger, ghost. Sizes: sm, md, lg. Loading state. |
| `Input` | Native + Tailwind | With label, error message, helper text. Auto-links with React Hook Form. |
| `Textarea` | Native + Tailwind | Character count, auto-resize. |
| `Select` | Radix Select | Accessible dropdown. |
| `Badge` | Tailwind | Color-coded by type (verification level, urgency, category). |
| `Avatar` | Radix Avatar | Fallback to initials. |
| `Card` | Tailwind | Used for feed cards, case cards, profile cards. |
| `Dialog` | Radix Dialog | Used for confirmations, consent requests, report forms. |
| `DropdownMenu` | Radix DropdownMenu | User menu, post action menu. |
| `Toast` | Radix Toast | Non-blocking success/error notifications. |
| `Skeleton` | Tailwind animate | Loading placeholders matching content layout. |
| `Pagination` | Custom | "Load More" for feed, page numbers for admin tables. |

### Component Conventions

```tsx
// components/ui/button.tsx — Example structure
import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          {
            "bg-green-600 text-white hover:bg-green-700": variant === "primary",
            "bg-gray-100 text-gray-900 hover:bg-gray-200": variant === "secondary",
            "bg-red-600 text-white hover:bg-red-700": variant === "danger",
            "bg-transparent hover:bg-gray-100": variant === "ghost",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
```

### Domain Component Patterns

**Feed Card:**

```tsx
// components/feed/feed-card.tsx
interface FeedCardProps {
  post: PostSummary;
}

export function FeedCard({ post }: FeedCardProps) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <Avatar name={post.author.name} size="sm" />
        <span className="font-medium">{post.author.name}</span>
        <VerificationBadge level={post.author.verification_level} />
      </div>
      <h3 className="font-semibold text-lg">{post.title}</h3>
      <p className="text-gray-600 line-clamp-2 mt-1">{post.description}</p>
      <div className="flex items-center gap-2 mt-3">
        <Badge variant="category">{post.category}</Badge>
        <Badge variant={post.urgency}>{post.urgency}</Badge>
        <span className="text-sm text-gray-500">{post.city}</span>
        <span className="text-sm text-gray-400 ml-auto">{formatTimeAgo(post.created_at)}</span>
      </div>
    </Card>
  );
}
```

---

## 6. State Management & Data Fetching

### Strategy Overview

| State Type | Tool | Examples |
| ---------- | ---- | -------- |
| **Server state** (remote data) | TanStack Query v5 | Feed posts, case data, notifications, messages |
| **Client state** (UI-only) | Zustand | Auth tokens, sidebar toggle, active modal, toast queue |
| **Form state** | React Hook Form + Zod | Post creation form, profile edit, report dialog |
| **URL state** | Next.js searchParams | Feed filters (city, category, urgency, search query) |

### TanStack Query — Configuration

```tsx
// lib/api/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 minutes: data is "fresh" for 2 min
      gcTime: 1000 * 60 * 10,          // 10 minutes: unused cache is garbage-collected
      retry: 2,
      refetchOnWindowFocus: true,      // re-validate when user returns to tab
      refetchOnReconnect: true,        // re-validate on network recovery
    },
    mutations: {
      retry: 0,                        // don't auto-retry mutations
    },
  },
});
```

### Query Hooks Pattern

```tsx
// lib/hooks/use-feed.ts
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api/posts";
import type { FeedFilters } from "@/lib/types/post";

export function useFeed(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: ["feed", filters],
    queryFn: ({ pageParam = 1 }) => fetchFeed({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.has_next ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });
}

// Usage in component:
function FeedPage() {
  const [filters] = useFeedFilters(); // reads from URL searchParams
  const { data, fetchNextPage, hasNextPage, isLoading } = useFeed(filters);

  return (
    <>
      {isLoading && <FeedSkeleton />}
      {data?.pages.map((page) =>
        page.items.map((post) => <FeedCard key={post.id} post={post} />)
      )}
      {hasNextPage && <LoadMoreButton onClick={() => fetchNextPage()} />}
    </>
  );
}
```

### Optimistic Updates

For actions with clear expected outcomes (offer help, post comment, mark notification read):

```tsx
// lib/hooks/use-offer-help.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { offerHelp } from "@/lib/api/cases";

export function useOfferHelp(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => offerHelp(caseId),
    onMutate: async () => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ["case", caseId] });
      // Snapshot previous value
      const previous = queryClient.getQueryData(["case", caseId]);
      // Optimistically update
      queryClient.setQueryData(["case", caseId], (old: any) => ({
        ...old,
        helper_count: old.helper_count + 1,
        user_is_helper: true,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on error
      queryClient.setQueryData(["case", caseId], context?.previous);
    },
    onSettled: () => {
      // Re-fetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}
```

### Zustand — Auth Store

```tsx
// lib/stores/auth-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      clearAuth: () => set({ accessToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken,
      hasRole: (role) => get().user?.roles.includes(role) ?? false,
    }),
    {
      name: "healall-auth",
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    },
  ),
);
```

### Caching Strategy Summary

| Data | Stale Time | Cache Time | Background Refresh | Rationale |
| ---- | ---------- | ---------- | ------------------ | --------- |
| Feed | 2 min | 10 min | On window focus | Feed should feel fresh but not hammer the server |
| Post detail | 5 min | 30 min | On window focus | Doesn't change frequently |
| Case detail | 1 min | 10 min | On window focus | Helpers may add notes frequently |
| Notifications | 30 sec | 5 min | Every 30 sec (polling) | Users expect near-real-time |
| Unread count | 30 sec | 5 min | Every 30 sec (polling) | Badge in nav bar |
| Messages | 10 sec | 5 min | Every 10 sec (polling) | Near-real-time DMs |
| User profile | 10 min | 60 min | On window focus | Rarely changes |
| Admin stats | 5 min | 10 min | On window focus | Dashboard data |

**Phase 2 upgrade:** Replace polling for notifications and messages with WebSocket (Server-Sent Events for notifications, WebSocket for DMs).

---

## 7. Authentication Flow on the Frontend

### Token Storage Decision

| Option | Pros | Cons | Decision |
| ------ | ---- | ---- | -------- |
| `httpOnly` cookie | XSS-immune, auto-sent | Needs CSRF protection, complex with SSR | **Chosen for refresh token** |
| `localStorage` | Simple, works with SSR | Vulnerable to XSS | **Not used** |
| In-memory (Zustand) | XSS-immune while tab is open | Lost on refresh → need silent refresh | **Chosen for access token** |

**Architecture:**

1. **Refresh token** is stored as an `httpOnly`, `Secure`, `SameSite=Lax` cookie. The backend sets this on login/refresh.
2. **Access token** is kept in memory (Zustand store). On page load, a silent `/v1/auth/token/refresh` call exchanges the cookie for a fresh access token.
3. **CSRF protection:** The backend includes a CSRF token in the login response. The frontend sends it as `X-CSRF-Token` header on all mutating requests (POST, PATCH, DELETE) when using cookie auth.

### Route Protection

```tsx
// components/auth/require-auth.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

export function RequireAuth({
  children,
  requiredRoles,
}: {
  children: React.ReactNode;
  requiredRoles?: string[];
}) {
  const router = useRouter();
  const { isAuthenticated, hasRole, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    if (requiredRoles && !requiredRoles.some((r) => hasRole(r))) {
      router.replace("/feed"); // redirect unauthorized users to feed
    }
  }, [isAuthenticated, hasRole, requiredRoles, router]);

  if (!isAuthenticated()) return null;
  if (requiredRoles && !requiredRoles.some((r) => hasRole(r))) return null;

  return <>{children}</>;
}

// Usage in layout:
// app/(admin)/layout.tsx
export default function AdminLayout({ children }) {
  return (
    <RequireAuth requiredRoles={["admin", "head_admin", "moderator", "case_verifier"]}>
      <AdminSidebar />
      <main>{children}</main>
    </RequireAuth>
  );
}
```

### API Client with Auth Interceptor

```tsx
// lib/api/client.ts
import { useAuthStore } from "@/lib/stores/auth-store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestConfig extends RequestInit {
  requireAuth?: boolean;
}

export async function apiClient<T>(
  path: string,
  config: RequestConfig = {},
): Promise<T> {
  const { requireAuth = true, ...fetchConfig } = config;

  const headers = new Headers(fetchConfig.headers);
  headers.set("Content-Type", "application/json");

  if (requireAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...fetchConfig,
    headers,
    credentials: "include", // send httpOnly cookies (refresh token)
  });

  if (response.status === 401 && requireAuth) {
    // Try silent refresh
    const refreshed = await silentRefresh();
    if (refreshed) {
      // Retry original request with new token
      headers.set("Authorization", `Bearer ${useAuthStore.getState().accessToken}`);
      const retryResponse = await fetch(`${BASE_URL}${path}`, {
        ...fetchConfig,
        headers,
        credentials: "include",
      });
      if (!retryResponse.ok) throw await parseError(retryResponse);
      return retryResponse.json();
    }
    // Refresh failed → logout
    useAuthStore.getState().clearAuth();
    window.location.href = "/login";
  }

  if (!response.ok) throw await parseError(response);
  return response.json();
}
```

---

## 8. Integration Contract with Backend

### API Base URL

```
Development: http://localhost:8000/v1
Production:  https://api.healall.in/v1
```

### Example API Calls (mirrors backend OpenAPI)

```tsx
// lib/api/auth.ts
import { apiClient } from "./client";

export interface SignupRequest {
  name: string;
  phone: string;
  email: string;
  city: string;
  age_range: string;
  invite_code: string;
  roles: string[];
}

export interface SignupResponse {
  id: string;
  name: string;
  verification_level: number;
  pending_verification: string[];
  message: string;
}

export function signup(data: SignupRequest): Promise<SignupResponse> {
  return apiClient("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
    requireAuth: false,
  });
}

// lib/api/posts.ts
export interface CreatePostRequest {
  title: string;
  description: string;
  category: string;
  urgency: string;
  city: string;
  contact_prefs?: { whatsapp?: boolean; email?: boolean; phone?: boolean };
}

export interface PostResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  city: string;
  status: string;
  author: {
    id: string;
    name: string;
    verification_level: number;
  };
  created_at: string;
  updated_at: string;
}

export function createPost(data: CreatePostRequest): Promise<PostResponse> {
  return apiClient("/posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface FeedFilters {
  city?: string;
  category?: string;
  urgency?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
}

export function fetchFeed(filters: FeedFilters): Promise<PaginatedResponse<PostResponse>> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  return apiClient(`/feed?${params.toString()}`);
}
```

### Error Handling Convention

```tsx
// All API errors follow this shape (matching backend):
interface ApiError {
  error: {
    code: string;     // e.g., "VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND"
    message: string;  // Human-readable
    details?: Array<{ field: string; message: string }>;
  };
}

// Components use a shared error display:
function ErrorMessage({ error }: { error: ApiError }) {
  return (
    <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">
      <p className="font-medium">{error.error.message}</p>
      {error.error.details?.map((d) => (
        <p key={d.field} className="text-sm">{d.field}: {d.message}</p>
      ))}
    </div>
  );
}
```

---

## 9. Accessibility & Privacy

### Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
| ----------- | -------------- |
| **Keyboard navigation** | All interactive elements reachable via Tab. Radix UI primitives handle focus trapping in modals/dropdowns. Custom `focus-visible` ring on all focusable elements. |
| **Screen readers** | Semantic HTML (`<main>`, `<nav>`, `<article>`, `<section>`). ARIA labels on icon-only buttons. `role="alert"` on error messages. `aria-live="polite"` on toast notifications. |
| **Color contrast** | All text meets 4.5:1 contrast ratio. Urgency indicators use both color and text/icon (not color alone). |
| **Focus management** | On modal open, focus moves to first focusable element. On modal close, focus returns to trigger. Route changes announce page title via `<title>`. |
| **Forms** | Every input has a visible `<label>`. Error messages linked via `aria-describedby`. Required fields marked with `aria-required`. |
| **Images** | All `<img>` have `alt` text. Decorative images use `alt=""`. |
| **Motion** | Respect `prefers-reduced-motion`. Disable animations when the OS preference is set. |

**Testing tools:**
- `eslint-plugin-jsx-a11y` in lint
- Axe DevTools browser extension for manual testing
- Playwright accessibility assertions in E2E tests

### Privacy in the UI

| Principle | Implementation |
| --------- | -------------- |
| **PII minimization** | Public profiles show only: name, city, age range, skills, badges, verification level. Phone/email hidden unless user opts in. |
| **Aadhaar never shown** | UI shows only "ID Verified" badge. No Aadhaar number, no document preview after upload. |
| **Consent dialogs** | Before Aadhaar upload: explicit consent checkbox + "Why we need this" explainer. Before DM: consent dialog. Before impact story: opt-in checkbox. |
| **No clipboard of sensitive data** | Disable right-click/copy on identity verification pages. (Client-side only — not a security boundary, but a friction layer.) |
| **Session timeout** | Auto-logout after 30 minutes of inactivity. Toast warning at 25 minutes. |

---

## 10. Testing Strategy

### Testing Pyramid

```
         ╱╲
        ╱ E2E ╲          5-10 critical user flows (Playwright)
       ╱────────╲
      ╱Integration╲      Page-level rendering + API mocking (Testing Library)
     ╱──────────────╲
    ╱   Unit Tests    ╲   Components, hooks, utils (Vitest + Testing Library)
   ╱────────────────────╲
```

### Tools

| Layer | Tool | What to Test |
| ----- | ---- | ------------ |
| **Unit** | Vitest + React Testing Library | Individual components render correctly, hooks return expected data, utility functions work |
| **Integration** | Vitest + React Testing Library + MSW | Pages render with mocked API data, form submissions trigger correct API calls, error states render |
| **E2E** | Playwright | Full user flows: signup → create post → verify → offer help → close case |
| **Accessibility** | axe-playwright + eslint-plugin-jsx-a11y | Automated accessibility checks on every page |
| **Visual regression** | Playwright screenshots (optional) | Catch unintended UI changes |

### Example Tests

```tsx
// tests/unit/components/feed-card.test.tsx
import { render, screen } from "@testing-library/react";
import { FeedCard } from "@/components/feed/feed-card";

const mockPost = {
  id: "1",
  title: "Need help with hospital navigation",
  description: "Looking for someone to help guide my grandmother...",
  category: "navigation",
  urgency: "high",
  city: "Mumbai",
  author: { id: "u1", name: "Priya", verification_level: 2 },
  created_at: new Date().toISOString(),
};

test("renders post title and author name", () => {
  render(<FeedCard post={mockPost} />);
  expect(screen.getByText("Need help with hospital navigation")).toBeInTheDocument();
  expect(screen.getByText("Priya")).toBeInTheDocument();
});

test("shows urgency badge with correct variant", () => {
  render(<FeedCard post={mockPost} />);
  expect(screen.getByText("high")).toHaveClass("bg-orange-100"); // or whatever the urgency color is
});

test("shows verification badge for level 2", () => {
  render(<FeedCard post={mockPost} />);
  expect(screen.getByLabelText("ID Verified")).toBeInTheDocument();
});
```

```tsx
// tests/e2e/auth.spec.ts (Playwright)
import { test, expect } from "@playwright/test";

test("signup flow with valid invite code", async ({ page }) => {
  await page.goto("/signup");

  await page.fill('[name="name"]', "Test User");
  await page.fill('[name="phone"]', "+919876543210");
  await page.fill('[name="email"]', "test@example.com");
  await page.selectOption('[name="city"]', "Mumbai");
  await page.selectOption('[name="age_range"]', "18-24");
  await page.fill('[name="invite_code"]', "TEST-CODE");
  await page.click('text=I want to help');
  await page.click('text=Sign Up');

  // Should redirect to OTP page
  await expect(page).toHaveURL("/verify-otp");
  await expect(page.locator("text=OTP sent")).toBeVisible();
});
```

### Coverage Threshold

```json
// vitest.config.ts
{
  "test": {
    "coverage": {
      "thresholds": {
        "statements": 70,
        "branches": 65,
        "functions": 70,
        "lines": 70
      }
    }
  }
}
```

---

## 11. CI/CD & Deployment

### CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci-frontend.yml
name: CI — Frontend

on:
  push:
    branches: [main, develop]
    paths: ["frontend/**"]
  pull_request:
    branches: [main]
    paths: ["frontend/**"]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npm run type-check
        working-directory: frontend

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: frontend
      - run: npm run test -- --coverage
        working-directory: frontend

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: frontend
      - run: npx playwright install --with-deps
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
      - run: npx playwright test
        working-directory: frontend

  build:
    runs-on: ubuntu-latest
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
        working-directory: frontend
      # Deploy or build Docker image
```

### Deployment Targets

| Option | Best For | Notes |
| ------ | -------- | ----- |
| **Vercel** (recommended for MVP) | Fast deploys, preview branches, free tier, built for Next.js | Free tier is generous. Auto-preview for every PR. |
| Coolify (self-hosted) | Full control, no vendor lock-in | Self-hosted PaaS on your VPS. More ops work. |
| Docker + VPS | Co-locate with backend | Single VPS deployment. Use multi-stage Dockerfile. |

### Deployment Flow

```
feature branch → PR → CI (lint + test + e2e) → preview deploy (Vercel auto) →
  merge to main → CI (build) → production deploy (Vercel auto or manual)
```

### Frontend Dockerfile (for self-hosted)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
```

### Environment Variables

```bash
# .env.example
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_S3_BUCKET_URL=http://localhost:9000/healall-media
```

---

## 12. Offline & Mobile Considerations

### Mobile-First Responsive Design

India has over 700 million mobile internet users (most on 4G). The frontend must be optimized for mobile-web:

- **Responsive breakpoints:** `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px). Design mobile-first, enhance for desktop.
- **Touch targets:** Minimum 44x44px for all interactive elements (WCAG recommendation).
- **Bottom navigation:** On mobile, primary nav (Feed, Cases, Messages, Profile) is a fixed bottom bar for thumb reach.
- **Pull-to-refresh:** On feed page, pull down to refetch (via library like `react-pull-to-refresh`).

### Performance Budget

| Metric | Target | How |
| ------ | ------ | --- |
| First Contentful Paint | < 1.5s on 4G | SSR for initial page load, minimal client JS |
| Largest Contentful Paint | < 2.5s on 4G | Optimize images (next/image), lazy-load below-the-fold |
| Total JS bundle (first load) | < 150 KB gzipped | Code splitting via Next.js dynamic imports, tree-shaking |
| CLS (Cumulative Layout Shift) | < 0.1 | Skeleton loaders, explicit image dimensions |

### PWA (Phase 2)

For Phase 1, the web app works well in mobile browsers. In Phase 2, consider:

- **Service worker** for offline caching (cache feed data, show stale-while-revalidate)
- **Web app manifest** for "Add to Home Screen"
- **Push notifications** via Web Push API (replace polling)
- **Background sync** for submitting forms while offline

For MVP, focus on:
- Graceful offline handling: show "You're offline" banner, disable submit buttons
- Cache feed data in TanStack Query so the last-loaded feed is visible even if network drops
- Use `navigator.onLine` + event listeners to detect connectivity changes

---

## 13. Module / Task Breakdown (Full Pattern)

This section provides the exact task breakdown pattern for each module, matching the format specified in the requirements. Each task is implementable independently by a developer or agent.

---

### Module: Auth & Identity (Frontend)

**Purpose:** Invite-only signup, OTP verification, identity upload, login, and token management.

**Submodules:**

#### Signup Page
**Tasks:**
1. Create `/signup` page with form fields: name, phone, email, city (dropdown), age_range (dropdown), invite_code, role checkboxes
2. Implement Zod validation schema matching backend constraints (phone: `+91` + 10 digits, email format, age_range enum)
3. Call `POST /v1/auth/signup` on submit, handle 410 (invalid invite), 429 (rate limit) errors
4. On success, redirect to `/verify-otp` with phone/email passed via query or state

**Acceptance:** A user with a valid invite code can complete the signup form. Invalid invite shows an error. Missing fields show validation messages. Successful signup redirects to OTP page.

#### OTP Verification Page
**Tasks:**
1. Create `/verify-otp` page with OTP input (6-digit), phone/email display
2. Auto-focus OTP input, support paste
3. Call `POST /v1/auth/verify-otp` on submit
4. "Resend OTP" link with 60-second cooldown timer
5. On success, store tokens and redirect to `/identity` (or `/feed` if skipping)

**Acceptance:** User can enter OTP and verify. Resend works after cooldown. Wrong OTP shows error. Successful verification stores auth state and redirects.

#### Identity Upload Page
**Tasks:**
1. Create `/identity` page with Aadhaar upload form
2. Consent checkbox: "I consent to identity verification" (required before upload)
3. "Why do we need this?" expandable info section
4. File upload component (JPEG/PNG only, max 5 MB)
5. Upload to presigned S3 URL (call API for URL, then upload directly to S3)
6. Show progress bar during upload
7. After upload, show "Verification in progress" status
8. Poll `GET /v1/auth/identity/status` to show result

**Acceptance:** User can upload ID with consent. Upload shows progress. Status updates from pending to verified/failed. User can skip this step and do it later from settings.

#### Login Page
**Tasks:**
1. Create `/login` page with phone/email input + OTP flow
2. Call `POST /v1/auth/token` → receive access token + refresh cookie
3. Store access token in Zustand, redirect to `/feed`

**Acceptance:** Existing user can log in via OTP. Token is stored in memory. Refresh cookie is set by backend.

#### Token Management (Auth Store + Interceptor)
**Tasks:**
1. Implement Zustand auth store (access token, user object, roles)
2. Implement API client interceptor for auto-attaching Bearer token
3. Implement silent refresh on 401 (call `/v1/auth/token/refresh`)
4. Implement auto-logout on refresh failure
5. Implement session timeout (30 min inactivity)

**Acceptance:** Access token refreshes transparently. Expired sessions redirect to login. Inactivity timeout shows warning then logs out.

---

### Module: Feed & Discovery (Frontend)

**Purpose:** Display verified help requests, filter/search, and link to post detail.

**Submodules:**

#### Feed Page
**Tasks:**
1. Create `/feed` page with `useFeed` infinite query hook
2. Implement `FeedCard` component (title, description truncated, category, urgency, city, author, time ago)
3. Infinite scroll with "Load More" button
4. Skeleton loading state (3-4 skeleton cards)
5. Empty state: "No help requests match your filters"

**Acceptance:** Authenticated users see a paginated feed of active posts. Infinite scroll loads more. Skeletons show during loading. Empty state when no results.

#### Feed Filters
**Tasks:**
1. Implement filter bar: city dropdown, category chips (multi-select), urgency toggle
2. Search input with debounce (300ms)
3. Sync filters with URL search params (shareable URLs)
4. Reset filters button

**Acceptance:** Filters update the feed in real-time. URL reflects current filters. Sharing URL preserves filters. Reset clears all.

---

### Module: Posts — Help Requests (Frontend)

**Purpose:** Create, view, and manage help request posts.

**Submodules:**

#### Create Post Form
**Tasks:**
1. Create `/posts/new` page with React Hook Form + Zod schema
2. Fields: title, description (rich text or plain), category dropdown, urgency selector, city, contact preferences
3. Optional media upload (max 5, drag-and-drop)
4. "Boundary Warning" dialog shown before final submit
5. Call `POST /v1/posts` then `POST /v1/posts/{id}/submit`
6. Success: redirect to post detail with "In verification queue" status

**Acceptance:** User can create a post with required fields. Boundary warning is shown before submission. Media can be attached. Post appears in "My Posts" with "submitted" status.

#### Post Detail Page
**Tasks:**
1. Create `/posts/[postId]` page
2. Show: full description, media gallery, category, urgency, city, author card, status badge, created time
3. "Offer Help" button (visible for active posts where user is not the author)
4. Comments section (list + form)
5. "Report" button in dropdown menu
6. If user is the author: edit button (while in draft/needs_info)

**Acceptance:** Post detail shows all information. Offer Help creates a case_helpers entry. Comments load and can be added. Report opens a dialog.

---

### Module: Cases (Frontend)

**Purpose:** Case dashboard, case detail with timeline, notes, and closure.

**Submodules:**

#### Cases Dashboard
**Tasks:**
1. Create `/cases` page with tabs: "As Seeker" | "As Helper" | "As Owner"
2. Case cards: linked post title, case status, helper count, last activity
3. Call `GET /v1/cases` with appropriate filters per tab
4. Empty states per tab

**Acceptance:** User sees their cases organized by role. Cards show key info. Clicking navigates to detail.

#### Case Detail Page
**Tasks:**
1. Create `/cases/[caseId]` page
2. Case timeline component (vertical): creation, helper joins, notes, updates, closure events
3. Helpers list with avatar, name, status
4. Add Note form: text, support type dropdown, hours contributed, optional attachment
5. Closure form (visible to case owner / verifier): resolution type, remarks, impact story opt-in
6. "Offer Help" / "Withdraw" button for helpers

**Acceptance:** Timeline shows all events. Notes can be added by case team. Closure form works with verifier confirmation. Impact story opt-in requires consent checkbox.

---

### Module: Messaging (Frontend)

**Purpose:** Consent-based DMs, conversation list, chat thread.

**Submodules:**

#### DM Consent Flow
**Tasks:**
1. "Message" button on post detail (opens consent dialog)
2. DM consent dialog: "You're requesting to message [Name] about [Post Title]. They must accept."
3. Call `POST /v1/messages/request-consent`
4. Show pending status in Messages list

**Acceptance:** Consent request is sent. Dialog explains the process. Pending requests are visible in messages.

#### Conversation List & Chat
**Tasks:**
1. Create `/messages` page with conversation list (last message preview, time, unread indicator)
2. Create `/messages/[conversationId]` with message thread
3. Message input (text only, send on Enter)
4. Poll for new messages (every 10 sec)
5. "End Conversation" button

**Acceptance:** Conversations list shows all active conversations. Messages display in chronological order. New messages appear via polling. Conversation can be ended.

---

### Module: Moderation & Reporting (Frontend)

**Purpose:** Report dialog, admin moderation queue, enforcement.

**Submodules:**

#### Report Dialog (User-Facing)
**Tasks:**
1. Report dialog component: reason dropdown (spam, harassment, fraud, solicitation, crisis, other), description textarea
2. Accessible from posts, comments, messages, profiles (via dropdown/menu)
3. Call `POST /v1/reports`
4. Success toast: "Report submitted. Our team will review it."

**Acceptance:** Users can report any content type. Duplicate reports are prevented. Success/error feedback shown.

#### Admin Moderation Queue
**Tasks:**
1. Create `/admin/moderation` page with pending reports table
2. Report detail: target content preview, reporter info, reason
3. Action form: warn, restrict, suspend (with duration input), ban, dismiss
4. Confirmation dialog before enforcement
5. Action history tab with filters

**Acceptance:** Admins see pending reports sorted by date. Actions are confirmed before execution. History shows all past actions.

#### Crisis Banner (Auto-Detected)
**Tasks:**
1. Crisis resources component showing emergency numbers (112, iCall, Vandrevala Foundation)
2. Auto-displayed when post/comment contains crisis keywords (client-side keyword list)
3. Non-dismissible during content creation

**Acceptance:** When a user types crisis-related keywords while creating a post, the crisis banner appears with helpline numbers. Banner cannot be dismissed during the creation flow.

---

### Module: Admin Tools (Frontend)

**Purpose:** Dashboard, user management, announcements, audit log.

**Submodules:**

#### Admin Dashboard
**Tasks:**
1. Create `/admin/dashboard` page
2. Stats cards: total users, active cases, pending verifications, pending reports, posts by category
3. Call `GET /v1/admin/stats`

**Acceptance:** Dashboard shows key metrics. Data refreshes on load.

#### Verification Queue
**Tasks:**
1. Create `/admin/verification-queue` page
2. List of submitted posts with author info + identity status
3. Expanded view with full post + author profile
4. Action buttons: Verify (with remarks form), Request Info, Reject (with reason)
5. Call appropriate `/v1/verification/*` endpoints

**Acceptance:** Verifiers see pending posts. Can verify, request info, or reject with remarks. Post status updates immediately in the UI.

#### User Management
**Tasks:**
1. Create `/admin/users` page with search/filter table
2. Filters: name, city, role, verification level
3. Role assignment (dropdown per user, head_admin only)
4. View user details + audit history

**Acceptance:** Admins can search users and view details. Head admin can change roles.

#### Announcements Management
**Tasks:**
1. Create `/admin/announcements` page (list + create)
2. Form: title, body (markdown), pinned toggle, include_in_digest toggle
3. Edit and delete existing announcements

**Acceptance:** Admins can CRUD announcements. Pinned announcements appear at top of feed.

#### Audit Log Viewer
**Tasks:**
1. Create `/admin/audit-log` page with paginated table
2. Columns: timestamp, actor, action, target, metadata
3. Filters: action type, actor, date range

**Acceptance:** Admins can browse and filter the audit trail.

---

### Module: Profile & Settings (Frontend)

**Purpose:** View/edit profile, skills, privacy controls, notification preferences.

**Submodules:**

#### My Profile
**Tasks:**
1. Create `/profile` page showing user info + edit form
2. Skills editor (tag-style input, add/remove)
3. Avatar upload
4. Badges display section
5. Verification level indicator (Level 0–3 with descriptions)

**Acceptance:** User can view and edit their profile. Skills can be added/removed. Badge section shows earned badges.

#### Public Profile
**Tasks:**
1. Create `/profile/[userId]` page
2. Show: name, city, age range, bio, skills, badges, verification badge
3. Respect privacy settings (hide phone/email if not opted in)
4. "Message" and "Report" buttons
5. "Block" option in dropdown

**Acceptance:** Public profile shows only permitted information. Contact info hidden by default. Block and report are accessible.

#### Settings Pages
**Tasks:**
1. `/settings` — general account settings
2. `/settings/privacy` — toggle show_email, show_phone, show_city
3. `/settings/notifications` — toggle email digest, SMS for critical notifications

**Acceptance:** Settings persist on save. Privacy changes reflect immediately on public profile.

---

### Module: Notifications (Frontend)

**Purpose:** In-app notification list, unread count, mark read.

**Tasks:**
1. Create `/notifications` page with paginated list
2. Notification item: icon by type, title, body preview, time ago, read/unread styling
3. Click navigates to referenced entity (post, case, conversation)
4. "Mark all as read" button
5. Notification bell in nav with unread count badge
6. Poll unread count every 30 seconds

**Acceptance:** Notifications display and link to relevant entities. Unread count updates in real-time. Mark-all-read works.

---

## 14. Implementation Roadmap

### Phase 1 — MVP (ordered by dependency and priority)

| Priority | Module | Complexity | Dependencies |
| -------- | ------ | ---------- | ------------ |
| P0 | Project setup (Next.js, Tailwind, TanStack Query, Zustand, CI) | Low | — |
| P0 | Design system / UI primitives (Button, Input, Card, Badge, Dialog, Toast) | Medium | Project setup |
| P0 | Auth pages (signup, OTP, login) + token management | Medium | UI primitives |
| P0 | App shell layout (navbar, sidebar, mobile nav, notification bell) | Medium | Auth |
| P1 | Feed page + feed card + filters + search | Medium | App shell |
| P1 | Post detail + comments | Medium | Feed |
| P1 | Create post form + boundary warning | Medium | Post detail |
| P1 | Case dashboard + case detail + timeline | High | Post detail |
| P1 | Case notes + closure form | Medium | Case detail |
| P2 | DM consent + conversation list + chat thread | Medium | Profiles |
| P2 | Profile (my + public) + skills editor + badges | Medium | Auth |
| P2 | Verification queue (admin) | Medium | Post detail |
| P2 | Report dialog + moderation queue (admin) | Medium | All content |
| P2 | Notifications page + bell + polling | Medium | All modules |
| P3 | Admin dashboard + user management | Medium | Admin layout |
| P3 | Announcements management | Low | Admin layout |
| P3 | Audit log viewer | Low | Admin layout |
| P3 | Identity upload (Aadhaar) | Medium | Auth |
| P3 | Settings (privacy + notifications) | Low | Profile |

### Phase 2+ (future)

- WebSocket for real-time messages and notifications (replace polling)
- PWA: service worker, offline caching, push notifications, "Add to Home Screen"
- Dark mode toggle
- Multi-language support (next-intl)
- Resource library pages
- Workshop/events module
- Advanced search with filters and suggestions
- Mobile app (React Native, sharing component logic)

---

## 15. Security Checklist (Frontend-Specific)

- [ ] Access tokens stored only in memory (Zustand), never in localStorage
- [ ] Refresh tokens in `httpOnly` `Secure` `SameSite=Lax` cookies (set by backend)
- [ ] CSRF token sent on all mutating requests
- [ ] All user-generated content rendered with proper escaping (React's default behavior)
- [ ] No `dangerouslySetInnerHTML` without explicit sanitization (DOMPurify if needed for markdown)
- [ ] File upload validation: client-side type/size checks before upload
- [ ] Aadhaar number never displayed in UI (only verification status)
- [ ] No sensitive data in URL params or browser history
- [ ] Content Security Policy headers configured via `next.config.ts` or reverse proxy
- [ ] Subresource Integrity (SRI) for any CDN-loaded scripts (prefer self-hosting)
- [ ] Dependencies audited regularly: `npm audit` in CI

---

## 16. Developer Onboarding

### Prerequisites

- Node.js 20+ (recommend using `nvm` or `fnm`)
- npm (comes with Node) or pnpm
- Git

### Getting Started

```bash
# 1. Clone the repo
git clone <repo-url> && cd healall/frontend

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env.local

# 4. Start the dev server
npm run dev

# 5. Open the app
open http://localhost:3000

# 6. Run tests
npm test

# 7. Run E2E tests (requires backend running)
npx playwright test

# 8. Lint and type-check
npm run lint && npm run type-check
```

### `package.json` Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  }
}
```

### Development Conventions

- **Branch naming:** `feat/feed-filters`, `fix/otp-timer`, `chore/upgrade-next`
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Component files:** PascalCase (`FeedCard.tsx`). One component per file. Co-locate styles/tests with component when practical.
- **API functions:** camelCase, verb-first (`fetchFeed`, `createPost`, `offerHelp`)
- **Types:** Suffix with purpose (`PostResponse`, `CreatePostRequest`, `FeedFilters`)
- **Hooks:** `use-` prefix, one file per hook (`use-feed.ts`, `use-auth.ts`)
- **Stores:** `-store` suffix (`auth-store.ts`, `ui-store.ts`)
- **Imports:** Prefer `@/` alias for project imports (configured in `tsconfig.json`)

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.0.0",
    "@hookform/resolvers": "^3.0.0",
    "zod": "^3.0.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-toast": "^1.0.0",
    "@radix-ui/react-avatar": "^1.0.0",
    "tailwind-merge": "^2.0.0",
    "clsx": "^2.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@playwright/test": "^1.0.0",
    "msw": "^2.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-jsx-a11y": "^6.0.0",
    "@types/react": "^19.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

*This README is a living document. Update it as architecture decisions evolve. When in doubt, refer back to the [HealAll Brochure](./HealAll_Brochure_v1.pdf) and [Architecture README](./HealAll_Architecture_README_v1.md) for product-level guidance.*
