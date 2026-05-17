# HealAll — Master Design Brief for Claude Design

> **Purpose**: A single, self-contained document to share with a design-focused Claude (or any external designer) so they can generate high-quality screens, flows, and a refreshed visual language for HealAll without needing the codebase.
>
> **How to use**: Paste this entire file as the first message in a fresh Claude Design conversation. Then ask for the specific deliverable you want (e.g. "redesign the feed", "make a Figma-ready spec for the case detail screen").
>
> **Status of current design**: Functional but inconsistent. Strong tokens in `globals.css`; weak visual hierarchy on admin/messaging/case screens; mobile responsiveness uneven; no illustration system; no empty-state library; no motion language.

---

## 1. Product One-Pager

| Field | Value |
|---|---|
| **Name** | HealAll |
| **Tagline** | Helping in Any Way Possible |
| **Domain** | healallindia.com |
| **Category** | Invite-only community mutual-aid platform |
| **Market** | India-first, English + Hindi roadmap |
| **Form factor** | Web-only (responsive). No native app yet. |
| **Stack** | Next.js 15 (App Router), TypeScript, vanilla CSS (no Tailwind, no shadcn) |
| **Font** | DM Sans (Google Fonts) |
| **Logo** | Green→Blue split-heart with two reaching hands + "HealAll" wordmark |

### What HealAll is
A neighbourhood-scale platform where verified members **post requests for help** (blood donors, medicine, shelter, food, financial aid, mentorship, emotional support, navigation help) and other members **offer help** — through chat, on-ground meetups, or case-managed cooperation.

### What HealAll is NOT
- ❌ Not a hospital or insurance product (avoid clinical white + red-cross aesthetics)
- ❌ Not a fundraising platform like Ketto/GoFundMe (we coordinate help, we don't process donations)
- ❌ Not a corporate SaaS dashboard (warmth > efficiency)
- ❌ Not a dating-style swipe app
- ❌ Not anonymous (every member is invite-verified)

### Tone analogies
**Instagram** (photo-led cards, stories) + **GoFundMe** (urgency, cause) + **neighbourhood WhatsApp group** (warmth, intimacy) + **Duolingo** (friendly micro-illustrations, encouragement).

---

## 2. Audience & Personas

### P1 — The Requester (60% of activity)
- 22–55, lower-middle to middle income, urban India
- Family member needs blood / medicine / shelter / food
- Anxious, time-pressured, mobile-first (often 4G, mid-tier Android)
- Wants: post fast, see response immediately, feel safe & private

### P2 — The Helper (30% of activity)
- 25–45, professional, has 30 min/day, motivated by community
- Scrolls feed during commute, offers help, sometimes coordinates on-ground
- Wants: feel impact, browse cases by city/category, trust the requester is real

### P3 — The Moderator / Admin (~10 users total)
- Volunteer, often power-user, uses desktop
- Reviews verification queue, handles reports, applies actions (warn/restrict/suspend/ban)
- Wants: dense info, decision-making affordances, audit trail

### P4 — The First-time Invite Recipient
- Just got a code from a friend
- Skeptical: "is this legit?"
- Wants: a 30-second sense of what this is and who's already here

---

## 3. Core Mental Model

```
Member ── posts ──▶  Post  (request for help)
                       │
                       ├── offers/comments
                       │
                       └─ may escalate into ──▶ Case (coordinated, multi-party)
                                                  │
                                                  ├── notes (timeline)
                                                  └── resolution (closed)
```

Plus: **invites**, **direct messages**, **reports**, **verification queue**, **profile/skills**.

---

## 4. Information Architecture / Sitemap

```
/                   Landing (logo, CTAs, community guidelines, dev contribute)
/signup             Invite-code-gated signup (phone + Google OAuth)
/login              Phone or Google
/verify-otp         OTP step
/feed               Main authenticated home — post stream + sidebar filters
/posts/new          Compose a new request
/posts/[id]         Single post detail + comments + offer-help
/cases              List of active/closed cases for the user
/cases/[id]         Case detail with timeline, notes, helpers, closure
/messages           Conversation list
/messages/[id]      Chat thread (Instagram-style bubbles)
/invites            See your invite codes, generate new ones
/profile            View + edit own profile, verification, skills, privacy
/admin/dashboard    Counts, recent activity (admin/moderator only)
/admin/verification Post verification queue
/admin/moderation   Reports + action history
/privacy-policy     Static legal page
/terms              Static legal page
```

**Nav links shown (top bar)**: Feed · Cases · Messages · Invites · Profile · (Admin if role)

---

## 5. Current Brand & Visual Language

### Brand colours (DO NOT CHANGE)
The signature **green→blue gradient** maps to the two halves of the logo heart. It is the soul of the brand.

```css
--brand-green:    #16a34a    /* left half of heart, primary CTA */
--brand-blue:     #2563eb    /* right half of heart, secondary accent */
--gradient-brand: linear-gradient(135deg, #16a34a, #2563eb)
```

### Neutral scale
```css
--bg:             #ffffff    /* page bg */
--bg-subtle:      #f9fafb    /* hover, code blocks */
--surface:        #ffffff    /* cards */
--border:         #f3f4f6    /* card borders, dividers */
--border-strong:  #e5e7eb    /* input borders */
--text:           #111827    /* headings */
--text-muted:     #6b7280    /* body, nav links */
--text-subtle:    #9ca3af    /* timestamps */
```

### Semantic / category colours
| Category | Token | Foreground | Background | Emoji |
|---|---|---|---|---|
| Urgent | `--urgent` | `#e11d48` | `#fff1f2` | 🆘 |
| Medicine | `--medicine` | `#d97706` | `#fffbeb` | 💊 |
| Shelter | `--shelter` | `#2563eb` | `#eff6ff` | 🏠 |
| Food | `--food` | `#16a34a` | `#f0fdf4` | 🍱 |
| Finance | `--finance` | `#7c3aed` | `#faf5ff` | 💸 |
| Mentorship | (blue) | `#2563eb` | `#eff6ff` | 🎓 |
| Skills | (green) | `#16a34a` | `#f0fdf4` | 🔧 |
| Emotional support | (amber) | `#f59e0b` | `#fef3c7` | 🤗 |
| On-ground | (amber-orange) | `#d97706` | `#fffbeb` | 🤝 |
| Navigation | (violet) | `#7c3aed` | `#faf5ff` | 🧭 |

### Typography
**Font**: `'DM Sans', system-ui, -apple-system, sans-serif`
| Scale | Size | Weight | Use |
|---|---|---|---|
| Display | 28px | 800 | Hero headings |
| H1 | 22px | 700 | Page titles |
| H2 | 18px | 700 | Section headings |
| H3 | 15px | 700 | Card titles |
| Body | 13px | 400 | Default |
| Small | 11px | 500 | Timestamps, meta |
| Label | 10px | 700 | Uppercase labels, badges |

### Radius, shadow, spacing
```css
--radius-sm:   8px      /* chips */
--radius-md:   10px     /* buttons, inputs */
--radius-lg:   16px     /* sidebar cards */
--radius-xl:   20px     /* feed cards */
--radius-full: 9999px   /* pills, avatars */

--shadow-card:       0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)
--shadow-card-hover: 0 6px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)
--shadow-btn:        0 3px 12px rgba(22,163,74,0.30)
--shadow-nav:        0 1px 12px rgba(0,0,0,0.06)
```
**Spacing scale**: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64` (16px base).

### Logo wordmark recipe
```css
background: linear-gradient(135deg, #16a34a, #2563eb);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
font-weight: 800;
```

---

## 6. Component Inventory (current)

| Component | Status | Where defined |
|---|---|---|
| Card (`.card`) | ✅ Solid | `globals.css` |
| Primary button | ✅ | `globals.css` (`button`, `.btn-primary`) |
| Ghost button | ✅ | `button.ghost` |
| Secondary button | ✅ | `button.secondary` — light-green fill |
| Danger button | ✅ | `button.danger` |
| Input / select / textarea | ✅ | `globals.css` |
| Filter chip | ✅ | `.chip`, `.chip.active` |
| Category badge | ✅ | `.badge`, `.badge-urgent`, etc. |
| Verification pill | ✅ | `.vbadge` (✓ Verified) |
| Top nav | ✅ | `nav.main-nav` |
| Stories row | ⚠️ Sparse | `frontend/components/feed/` |
| Feed card | ✅ | `frontend/components/feed/feed-card.tsx` |
| Sidebar | ✅ | `frontend/components/feed/feed-sidebar.tsx` |
| Empty state | ❌ Ad-hoc per page | — |
| Toasts / inline alerts | ⚠️ Only `.error`, `.success` text | — |
| Modal / dialog | ❌ None | — |
| Avatar | ⚠️ Inline styles, no component | — |
| Skeleton loaders | ❌ Only "Loading…" text | — |
| Loading spinner | ❌ Nothing | — |
| Date picker | ❌ Native `<input type="date">` | — |
| Tabs | ⚠️ Manual button rows | — |
| Tooltip | ❌ | — |
| Bottom-sheet (mobile) | ❌ | — |

---

## 7. Screen Inventory & UX Notes (the "what to redesign" list)

### 7.1 Landing (`/`)
- Hero: gradient wordmark, two CTAs (Join / Sign in), category pills row.
- Embedded Google Drive PDF for Community Guidelines (replace with proper rendered page).
- Contributor section with tech stack.
- **Pain points**: PDF iframe feels hacky; no social proof; no "what is HealAll" visual story.

### 7.2 Signup (`/signup`)
- Invite code field → phone → Google OAuth fallback.
- **Pain points**: Google button width was previously misaligned on mobile (fixed). Stepper missing — feels like a wall of fields.

### 7.3 Feed (`/feed`)
- Category bubble row at top.
- 1000px max-width, 2-col layout (feed 1fr + sidebar 300px).
- Cards: avatar + author + verification pill + category badge, photo placeholder, title + caption + tags, action row (Offer Help / 💬 / Share / helpers count), comment preview.
- **Pain points**: Cards are text-heavy when posts have no photo; no skeleton; no "new posts" pill; sidebar feels static.

### 7.4 Post detail (`/posts/[id]`)
- Same feed-card structure, expanded, full comments thread.
- Inline offer-help form.
- **Pain points**: No clear "I helped" CTA distinct from "I want to offer help"; comment thread visually flat.

### 7.5 Compose post (`/posts/new`)
- Plain stacked form: title, category, urgency, city, description, optional photo.
- **Pain points**: Doesn't preview as a card; no autosave; no "drafts".

### 7.6 Cases list (`/cases`)
- Recently polished: `StatusBadge` (active / pending_closure / closed), `CaseCard` with urgency colour, helper count, total in header.
- Empty state links to feed.
- **Pain points**: No filtering by status, no search; no progress indicator on long-running cases.

### 7.7 Case detail (`/cases/[id]`)
- Back-link, post snippet, helpers list, notes timeline, add-note form, closure section (resolution dropdown).
- Conditional CTAs: `Offer Help` (active only), `Reopen` (closed only).
- **Pain points**: Visually dense; no clear narrative timeline; closure section feels bureaucratic.

### 7.8 Messages list (`/messages`)
- `ConvCard`: other-user truncated ID, last message preview, time-ago, unread indicator (TBD).
- **Pain points**: No avatars (we only have UUIDs of the other participant — need to resolve name client-side or via API expansion); no search.

### 7.9 Conversation (`/messages/[conversationId]`)
- Chat bubbles, isMine right-aligned green, isOther left-aligned grey, formatTime helper, auto-scroll, refocus input.
- Disabled input when `conversation.ended_at` is set.
- **Pain points**: No typing indicator, no read receipts beyond text "Read", no attachment UI, no system messages ("Helper joined the case").

### 7.10 Profile (`/profile`)
- `VerificationBadge`, `RolePill`, `SkillChip` sub-components.
- Avatar with initials fallback.
- 2-col grid for name/city, Enter-key skill add.
- Privacy section with description text per toggle.
- **Pain points**: Public profile vs edit-profile not differentiated; no preview of "how others see you".

### 7.11 Invites (`/invites`)
- List of generated codes, copy button, generate-new CTA.
- **Pain points**: No "who joined via my invite" graph; no share-via-WhatsApp deep link with prefilled text.

### 7.12 Admin dashboard (`/admin/dashboard`)
- Counts (pending verifications, pending reports), recent activity.
- **Pain points**: Counts feel disconnected from action; no time-series; no SLA indicator.

### 7.13 Admin verification queue (`/admin/verification`)
- `QueueCard`: post title as link, urgency colour, time-ago, author badge.
- Per-card remarks textarea, action buttons (Verify / Request info / Reject).
- **Pain points**: Reviewer can't see post photo inline; can't compare two suspicious posts side-by-side.

### 7.14 Admin moderation (`/admin/moderation`)
- Pill-style status filter (pending/reviewing/resolved/dismissed).
- `InlineActionForm` per report: action dropdown, target user ID (pre-filled with reporter_id), reason, duration hours (for suspend/restrict).
- Action history section below with colour badges.
- **Pain points**: Pre-filling target as **reporter** is confusing — should usually default to post-author or reported user (UX bug to flag).

---

## 8. Voice & Microcopy

### Voice principles
1. **Warm but precise.** "We sent your offer to Aarti" beats "Action submitted successfully".
2. **First-person plural for the platform** ("we"), **second person for the user** ("you").
3. **Action-led button labels.** "Offer help" not "Submit". "Send a message" not "Confirm".
4. **No corporate hedging.** Avoid "Please note that…", "We regret to inform you…".
5. **India-aware.** Use ₹, rupee names, Indian city auto-suggest (Bengaluru / Bangalore both ok).
6. **Crisis-safe.** Posts tagged "crisis" must never be auto-deleted or hidden silently. Show "We've routed this to a moderator. You're not alone."

### Empty-state microcopy library (use these as templates)
| Page | Headline | Sub | CTA |
|---|---|---|---|
| Feed (no posts) | "Quiet in your city" | "Be the first to post a request or change your filters." | "Post a request" |
| Cases (none) | "No active cases yet" | "When you offer help on a post, it becomes a case here." | "Browse feed" |
| Messages (none) | "Your inbox is empty" | "Start a conversation by offering help on a post." | "Open feed" |
| Verification queue (clear) | "All caught up ✨" | "No posts waiting for review." | (no CTA) |
| Profile incomplete | "Add a few details" | "Members trust profiles with a photo and city." | "Edit profile" |

---

## 9. Motion & Interaction (proposed — currently bare)

- **Card hover**: shadow lift, 150ms ease.
- **Page transitions**: 200ms fade-in for route changes.
- **Like / offer-help confirmation**: heart-burst micro-animation (Lottie-friendly).
- **Toast**: slide up from bottom, auto-dismiss 3s.
- **Skeletons**: shimmer on `--bg-subtle` for feed cards while loading.
- **Modal**: scale-in 0.96→1, fade overlay 0→0.4, 180ms.
- Respect `prefers-reduced-motion`.

---

## 10. Accessibility Targets

- **WCAG 2.1 AA** minimum.
- Contrast: 4.5:1 for body text; 3:1 for ≥18px. Current `#9ca3af` on `#fff` is **3.5:1** — borderline; only use for time-stamps.
- Focus rings: keep the current 3px green ring on inputs; extend to buttons and links.
- All icons that aren't decorative must have an `aria-label`.
- Forms: every input has a `<label>`; error text is `aria-describedby` linked.
- Modals trap focus and return it.
- Keyboard: stories row, filter chips, comment threads all keyboard-navigable.
- Targets ≥44×44px on mobile.

---

## 11. Mobile & Responsive Notes

- Single breakpoint today: `@media (max-width: 768px)`.
- On mobile: single column, nav links hidden (need a hamburger / bottom-nav).
- **Proposal**: bottom-nav (5 icons: Feed · Cases · Post · Messages · Profile) for mobile, top-nav for desktop. Post button is the centre, gradient-filled circle, raised.
- All photos: lazy-loaded, aspect-ratio 1.6:1, blurhash placeholder.
- Touch targets ≥44px.
- Avoid hover-only affordances.

---

## 12. Trust & Safety as a Design Surface

Trust is the product. Surface it visibly:

- **Verification levels**: L0 (new), L1 (phone), L2 (Aadhaar/DigiLocker), L3 (community-vouched). Use green tick variants — single tick L1, double L2, gold L3.
- **Invite chain**: a profile may optionally show "Invited by Priya R." with a small chevron.
- **Post verified**: a `Verified by moderator` strip on the post card when a post passes the queue.
- **Case helpers**: avatars stacked, ≥3 = "+N more".
- **Report**: subtle, three-dot menu, never a giant red button.

---

## 13. Asset Inventory & Gaps

### Have ✅
- `frontend/public/logo.jpeg` — full logo with heart + wordmark
- `favicon-*.png` (16/32/48/64/128/256/512) + `apple-icon.png`
- Emoji as primary icon system (lightweight, universally rendered)

### Need 🟡
- SVG version of the logo (heart only + heart+wordmark, mono-colour variants).
- Custom icon set (24px line icons, 2px stroke) for: feed, cases, messages, invites, profile, admin, post, report, verified, helper, reopen, settings, search, filter, hamburger, close.
- Illustration set (4–6 hero illustrations) for: empty feed, empty cases, empty messages, all-caught-up moderation, signup welcome, post-published confirmation. Style: friendly, India-aware, gradient-aware (uses brand green+blue), no over-rendered 3D.
- OG/social images (1200×630) per major page.
- Lottie animations for offer-help heart burst, case-resolved confetti (subtle, brand-coloured).

---

## 14. Figma & External References

### Figma starter file (to create)
**Suggested file structure** when the designer opens Figma:

```
HealAll/
├─ 00 — Cover & Index
├─ 01 — Foundations
│   ├─ Colour styles    (brand, neutral, semantic, category)
│   ├─ Type styles      (display/H1–H3/body/small/label)
│   ├─ Effects          (shadows: card, card-hover, btn, nav)
│   └─ Grid + spacing
├─ 02 — Components
│   ├─ Buttons (primary / secondary / ghost / danger / icon)
│   ├─ Inputs / Selects / Textareas / Checkbox / Radio / Toggle
│   ├─ Badges (category, verification, status)
│   ├─ Chips
│   ├─ Card (feed / sidebar / case / message)
│   ├─ Avatar (sizes 24/32/40/56, with verification overlay)
│   ├─ Nav (top / bottom-mobile)
│   ├─ Empty states
│   ├─ Toasts & alerts
│   └─ Modals & bottom-sheets
├─ 03 — Screens — Auth flow
├─ 04 — Screens — Feed & Post
├─ 05 — Screens — Cases
├─ 06 — Screens — Messages
├─ 07 — Screens — Profile & Invites
├─ 08 — Screens — Admin
├─ 09 — Mobile responsive variants
└─ 10 — Motion specs (links to Lottie JSON)
```

### Reference products to study (designer should open these)
| Product | What to borrow |
|---|---|
| **Instagram** | Story rows, feed card density, double-tap heart, comment preview |
| **Nextdoor** | Neighbourhood card, verified-neighbour badge, calm typography |
| **GoFundMe** | Progress + helpers stacked avatars, urgency without panic |
| **Discord onboarding** | Invite-code flow, "you're invited by X" warmth |
| **Linear** | Admin dense views, keyboard-first power-user surfaces |
| **Notion** | Empty-state illustrations, friendly micro-copy |
| **WhatsApp** | Chat bubble simplicity, system messages |
| **Duolingo** | Friendly mascot energy without being childish |
| **Cred (India)** | Premium-feeling gradient + neutral palette restraint |
| **CRED Mint / Dot** | Indian UX patterns, ₹ typography |

### Specific Figma community files worth referencing (designer should search)
- "iOS 18 UI Kit" — for native-feel components if we go PWA
- "Untitled UI" — high-quality general component library, free
- "Material 3 Design Kit" — for input + form patterns
- "FANG iOS / Android UI Kit" — chat bubble references
- "Healthcare X UI Kit" — for cases UI, **but strip the clinical aesthetic**

> **Tip for the designer**: rather than copying any one of these, mix the warmth of Duolingo, the density of Linear's admin, and the social affordances of Instagram. Keep our gradient green→blue identity.

### Inspirational moodboard search terms
- "community mutual aid platform UI"
- "trust-based marketplace verification UI"
- "warm humanitarian product design"
- "Indian fintech UI" (for ₹, dense info, vernacular handling)
- "social network minimal feed card"

---

## 15. Open Design Questions (please answer in your redesign)

1. **Bottom-nav vs hamburger** on mobile — recommended bottom-nav with 5 items + centre Post button. Validate?
2. **Avatar system** — do we let users upload, generate from initials, or both? (Today: initials gradient.)
3. **Photo-required for posts?** — currently optional. Should urgent posts require a photo for trust?
4. **Anonymous reporting** — should reports be visible to the reported party? (Today: no.)
5. **Hindi support** — when do we localise? Recommendation: design English-only v1, but reserve space (Hindi runs 15–25% longer).
6. **Dark mode** — out of scope for v1?
7. **Crisis flow** — when a post is tagged "crisis" or auto-detected, what's the design treatment? (Helpline strip? Pause posting?)
8. **Verification level UI** — single tick / double tick / gold tick — okay or too WhatsApp-y?
9. **Modals vs full-page flows** — today everything is full-page. Should "offer help" become a modal?
10. **Toast system** — replace inline `.success`/`.error` text with toasts?

---

## 16. Constraints the designer must respect

- ✅ **No Tailwind classes.** Use semantic class names + CSS custom properties. Designer can ship HTML/CSS; we'll port.
- ✅ **Green→Blue gradient identity is fixed.** Don't propose a palette change.
- ✅ **DM Sans is fixed.** Don't propose a different font.
- ✅ **Logo asset is fixed** (`/logo.jpeg`). Can be reworked as SVG but the green-blue split-heart silhouette stays.
- ✅ **No third-party UI kits.** No shadcn, no MUI, no Chakra — components are hand-rolled.
- ✅ **No emojis as semantic icons in production** for v2 — replace with custom SVG icon set. Emoji ok for category branding and microcopy.
- ✅ **Web-only.** Designs need to work mouse+keyboard on desktop AND touch on mobile in the same code path.
- ✅ **India-aware.** Use ₹ for currency; Devanagari placeholder text optional; Indian names in mockups.

---

## 17. Deliverables wishlist (rank-ordered for the designer)

1. **Foundations page in Figma** — colour styles, type styles, shadow styles, spacing tokens, radius tokens, all mapped to the CSS variables above.
2. **Component library v1** — buttons, inputs, badges, chips, cards, avatars, nav, empty states, toasts, modals.
3. **Feed redesign** — desktop + mobile, with story row, card variants (photo / no-photo / urgent), skeleton.
4. **Case detail redesign** — narrative timeline, helpers stack, closure flow.
5. **Conversation thread redesign** — bubbles, system messages, typing, attachments slot.
6. **Profile redesign** — public view vs edit view, verification level system.
7. **Admin verification queue redesign** — side-by-side comparison view.
8. **Custom icon set** — 24px line, 2 stroke widths, ~30 icons.
9. **Illustration set** — 6 empty-state illustrations + signup welcome.
10. **Mobile bottom-nav system** with raised centre Post button.
11. **Motion spec** — Lottie JSONs for heart-burst and case-resolved confetti.
12. **OG / social images** — 1200×630 for landing, feed, case detail.

---

## 18. Working agreement with the design Claude

When the design Claude responds, they should:
- **Show, don't tell.** Provide concrete HTML+CSS snippets or ASCII wireframes for each screen, not just descriptions.
- **Map to existing tokens.** Reference `--brand-green`, `--radius-xl`, `--shadow-card` etc. by name.
- **Provide variants.** For each component: default / hover / focus / disabled / loading / error.
- **Provide responsive specs.** Show desktop (1000px), tablet (768px), mobile (375px) widths.
- **List trade-offs.** When proposing a change, name what gets worse, not just what gets better.
- **Stay on-brand.** No teal, no clinical red, no dark mode unless explicitly asked.

---

## 19. Quick visual sanity-check (paste this snippet to verify the palette renders right)

```html
<div style="font-family: 'DM Sans', sans-serif; padding: 24px;">
  <h1 style="background: linear-gradient(135deg, #16a34a, #2563eb);
             -webkit-background-clip: text; -webkit-text-fill-color: transparent;
             font-size: 28px; font-weight: 800;">HealAll</h1>
  <button style="background: linear-gradient(135deg, #16a34a, #2563eb);
                 color: #fff; border: 0; padding: 9px 20px; border-radius: 10px;
                 box-shadow: 0 3px 12px rgba(22,163,74,0.30); font-weight: 600;">
    Offer help
  </button>
  <span style="display: inline-block; margin-left: 12px; padding: 4px 11px;
               border-radius: 9999px; background: #fff1f2; color: #e11d48;
               font-size: 11px; font-weight: 700;">🆘 Urgent</span>
</div>
```
If that renders with the right gradient wordmark + gradient button + red Urgent pill, you've got the brand right.

---

## 20. Where to find more (if the designer needs deeper context)

| Doc | What's in it |
|---|---|
| `docs/HealAll_Architecture_README_v1.md` | Roles, RBAC, verification levels, post lifecycle |
| `docs/ROADMAP.md` | Phased product plan |
| `docs/design/DESIGN_SYSTEM.md` | Token-level reference (subset of this brief) |
| `docs/design/CLAUDE_DESIGN_CONTEXT.md` | Short paste-in version of this brief |
| `frontend/app/globals.css` | The authoritative current CSS tokens |
| `frontend/lib/constants.ts` | Enums: categories, urgencies, report reasons, mod actions |

---

*Last updated: 2026-05-16. Maintained by the HealAll engineering team. If you change the brand palette, update this file in the same PR.*
