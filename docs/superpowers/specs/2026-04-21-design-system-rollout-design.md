# Design System Rollout — Spec
**Date:** 2026-04-21  
**Scope:** Apply HealAll design system across all 16 frontend pages. New Instagram-style feed layout. Role-gated nav. Polished auth pages.

---

## Decisions Made

| Question | Decision |
|---|---|
| Sidebar data | Real data, best-effort — from existing feed response (total count, authors) |
| Stories row | Category quick-filter bubbles — 7 emoji circles, no API needed |
| Nav visibility | Role-gated — USER sees 5 links, MODERATOR adds Moderation, ADMIN adds Verify + Invites |
| OTP input | Split 6-box input with auto-advance + backspace handling |
| Implementation approach | B — extract feed pieces into components, edit rest in-place |

---

## Architecture

### New files
```
frontend/components/feed/
  category-bubbles.tsx   — 7 emoji category circles, click = filter, active state
  feed-card.tsx          — full post card: avatar/badge/photo/actions/comments
  feed-sidebar.tsx       — filter chips + city select + stats + recent authors
```

### Modified files
```
frontend/components/layout/app-shell.tsx
frontend/app/feed/page.tsx
frontend/app/login/page.tsx
frontend/app/signup/page.tsx
frontend/app/verify-otp/page.tsx
frontend/app/posts/new/page.tsx
frontend/app/posts/[postId]/page.tsx
```

---

## Component Specs

### `category-bubbles.tsx`
Props: `{ active: string; onChange: (category: string) => void }`

7 bubbles using **actual backend category values** from `postCategories` constant:

| Value | Emoji | Label | Color |
|---|---|---|---|
| `""` (all) | 💚 | All | gradient-brand |
| `urgent` | 🆘 | Urgent | `--urgent` |
| `emotional_support` | 🤗 | Support | `#f59e0b` / `#fef3c7` |
| `mentorship` | 🎓 | Mentorship | `#2563eb` / `#eff6ff` |
| `skill_sharing` | 🔧 | Skills | `#16a34a` / `#f0fdf4` |
| `navigation` | 🧭 | Navigate | `#7c3aed` / `#faf5ff` |
| `on_ground` | 🤝 | On Ground | `#d97706` / `#fffbeb` |

Each bubble: 56px circle with category color/bg, emoji, label below.  
`All` uses `--gradient-brand` background.  
Active state: border 3px solid category color (or gradient for All).  
Clicking a bubble calls `onChange(category)`. Scrollable row on mobile.

### `feed-card.tsx`
Props: `{ post: PostSummary }` (uses `PostSummary` from `lib/types/api.ts`)

Structure:
1. **Header**: 40px avatar (first letter of `author.name` + gradient bg keyed to author id), author name, `✓ Verified` vbadge if `author.verification_level >= 1`, city · relative time, category badge (`.badge-urgent` for `urgent`, else `.badge` with neutral style)
2. **Photo area**: `aspect-ratio: 16/9`, emoji placeholder keyed to category (`urgent`→🆘, `emotional_support`→🤗, `mentorship`→🎓, `skill_sharing`→🔧, `navigation`→🧭, `on_ground`→🤝)
3. **Title + description** (description truncated to 120 chars with "…" if longer)
4. **Actions row**: "Offer Help" (primary btn) · "↗ Share" (ghost, copies URL to clipboard)

Click "Offer Help" or card title → `router.push(\`/posts/\${post.id}\`)`.  
No API calls inside this component — all data from the `post` prop.  
No comment preview — `PostSummary` does not include comment data.

### `feed-sidebar.tsx`
Props: `{ feedResult: FeedResponse | null; filters: FeedFilters; onFilterChange: (f: Partial<FeedFilters>) => void }`

Three sidebar cards:

**Filter card**
- Chip row: All · Nearby · High Urgency · Verified only → map to filter fields
- City `<select>` populated from `[...new Set(feedResult?.items.map(p => p.city))]` + "All cities" option

**Community card**
- "Active posts": `feedResult?.total ?? —`
- "Unique helpers": `new Set(feedResult?.items.map(p => p.author.id)).size` (unique authors across current page)
- "Cities covered": `new Set(feedResult?.items.map(p => p.city)).size`

**Recent helpers card**
- First 3 unique authors from feed items (deduplicated by id)
- 36px avatar (initials + gradient), name, city · category, "View →" link to `/profile/[id]`

---

## AppShell Changes (`app-shell.tsx`)

1. **Logo**: `<Image src="/logo.jpeg" alt="HealAll" width={32} height={32} />` + `<span className="logo-text">HealAll</span>` (gradient wordmark via CSS class already defined)
2. **Active link**: remove inline `style={{ color: '#0f766e' }}` — use `className` with `active` class from globals.css
3. **Role-gated links**: read `user?.roles` array from auth store

```
const userRoles = user?.roles ?? [];
const isMod   = userRoles.some(r => ['MODERATOR','ADMIN','HEAD_ADMIN'].includes(r));
const isAdmin = userRoles.some(r => ['ADMIN','HEAD_ADMIN'].includes(r));
```

Link sets:
- All authed: Feed, New Post, Cases, Messages, Profile
- + Moderator: Moderation
- + Admin: Verify, Invites

4. **User pill**: show `user.name · L{user.verification_level}` with `.vbadge` styling (already in globals.css)

---

## Feed Page (`feed/page.tsx`)

Layout:
```tsx
<main>
  <CategoryBubbles active={filters.category} onChange={cat => applyFilter({category: cat})} />
  <div className="feed-layout">           {/* 1fr + 300px grid from globals.css */}
    <div className="feed-col">
      {result?.items.map(post => <FeedCard key={post.id} post={post} />)}
    </div>
    <FeedSidebar feedResult={result} filters={filters} onFilterChange={applyFilter} />
  </div>
</main>
```

Remove: the `<section className="card">` filter form (filters now live in sidebar + category bubbles).  
Keep: loading state, error state, AuthRequired guard, `useEffect` on token.

Search input moves into sidebar filter card as a text input above the chips.

---

## Auth Pages

### `login/page.tsx`
- Remove `<h1>Login (Module 1)</h1>` and description paragraph
- Add logo block (heart icon + gradient wordmark) at top of card
- Heading: "Welcome back", sub: "Sign in with your OTP to continue"
- Add link at bottom: "Don't have an account? Sign up"
- Keep all existing form logic unchanged

### `signup/page.tsx`  
- Remove dev heading
- Add logo block
- Heading: "Join HealAll", sub: "India's mutual-aid community"
- Add invite-note banner: "🔒 Invite-only — enter your invite code to continue" (purple tint, `#faf5ff`)
- Add link at bottom: "Already have an account? Sign in"

### `verify-otp/page.tsx`
- Remove dev heading
- Add logo block
- Heading: "Verify your number", sub: "Enter the 6-digit code sent to your phone"
- Replace single OTP `<input>` with 6-box split input:
  - 6 × `<input maxLength={1}>` in a flex row
  - `onKeyUp`: if digit entered and not last box, focus next; if Backspace and empty, focus prev
  - Collect all 6 values → join → pass to existing submit handler
- Keep resend logic unchanged

---

## Posts Pages

### `posts/new/page.tsx`
- Remove "Create Post (Module 1)" heading
- Heading: "Share a Request", sub: "Describe what you need — our community will help"
- Category `<select>` options get emoji prefix: `🆘 urgent`, `💊 medicine`, `🏠 shelter`, `🍱 food`, `💸 financial`, `🤗 emotional_support`
- Group fields into visual sections with small `<h3>` dividers: "What do you need?" / "Details" / "Location"
- Keep all existing form logic unchanged

### `posts/[postId]/page.tsx`
- Top: "← Back to feed" ghost link
- Post rendered with feed-card style header (avatar + verification badge + category badge)
- Full description (no truncation)
- Action bar matching feed card
- Comments section below as stacked cards
- Keep all existing API calls + logic unchanged

---

## What's Explicitly Out of Scope
- Real profile photos (photo area stays emoji placeholder)
- Infinite scroll / pagination (existing page=1 stays)
- Upload frontend wiring (separate task)
- Other pages: cases, messages, admin, profile — unchanged in this task
- New backend endpoints

---

## File Size Check
- `feed/page.tsx` target: <150 lines (down from 193 — most logic moves to components)
- Each new component: <150 lines
- `app-shell.tsx` target: <100 lines
- Auth pages: ~80–100 lines each
