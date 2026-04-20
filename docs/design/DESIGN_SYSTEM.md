# HealAll Design System

> This document is the **single source of truth** for the HealAll visual language. Reference it whenever writing UI code, reviewing PRs, or prompting an AI assistant for frontend work.

---

## Brand Identity

**Product**: HealAll — India-first community mutual-aid platform  
**Tagline**: Helping in Any Way Possible  
**Personality**: Warm, trustworthy, community-first. Feels like a helpful neighbour, not a hospital.  
**Logo**: Green-blue split heart with two reaching hands. See `assets/logo.jpeg`.  
**NOT**: Clinical, corporate, sterile, transactional.

---

## Colour Palette

### Brand Gradient
The signature gradient runs **green → blue**, matching the two halves of the logo heart.

| Token | Value | Use |
|---|---|---|
| `--color-brand-green` | `#16a34a` | Left half of logo, primary CTA |
| `--color-brand-blue` | `#2563eb` | Right half of logo, secondary accent |
| `--gradient-brand` | `linear-gradient(135deg, #16a34a, #2563eb)` | Buttons, avatars, active states |

### Neutral Scale
| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#ffffff` | Page background |
| `--color-surface` | `#f9fafb` | Hover states, code blocks |
| `--color-border` | `#f3f4f6` | Card borders, dividers |
| `--color-border-strong` | `#e5e7eb` | Input borders, form elements |
| `--color-text` | `#111827` | Headings, primary text |
| `--color-text-muted` | `#6b7280` | Secondary text, nav links |
| `--color-text-subtle` | `#9ca3af` | Timestamps, captions |

### Semantic Colours
| Token | Value | Use |
|---|---|---|
| `--color-urgent` | `#e11d48` | Urgent badges/tags |
| `--color-urgent-bg` | `#fff1f2` | Urgent badge background |
| `--color-medicine` | `#d97706` | Medicine category |
| `--color-medicine-bg` | `#fffbeb` | Medicine badge background |
| `--color-shelter` | `#2563eb` | Shelter category |
| `--color-shelter-bg` | `#eff6ff` | Shelter badge background |
| `--color-food` | `#16a34a` | Food category |
| `--color-food-bg` | `#f0fdf4` | Food badge background |
| `--color-finance` | `#7c3aed` | Financial help |
| `--color-finance-bg` | `#faf5ff` | Finance badge background |

---

## Typography

**Font family**: `'DM Sans', system-ui, -apple-system, sans-serif`

| Scale | Size | Weight | Use |
|---|---|---|---|
| Display | 28px | 800 | Hero headings |
| H1 | 22px | 700 | Page titles |
| H2 | 18px | 700 | Section headings |
| H3 | 15px | 700 | Card titles |
| Body | 13px | 400 | Default text, captions |
| Small | 11px | 500 | Timestamps, meta info |
| Label | 10px | 700 | Uppercase labels, badges |

Logo wordmark: `font-size:18px; font-weight:800; background: var(--gradient-brand)` with `-webkit-background-clip: text`.

---

## Spacing Scale

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64`

Use 16px as the base unit. Card padding: 16–20px. Section gaps: 24–28px.

---

## Border Radius

| Name | Value | Use |
|---|---|---|
| `--radius-sm` | `8px` | Chips, small elements |
| `--radius-md` | `10px` | Buttons, inputs |
| `--radius-lg` | `16px` | Sidebar cards |
| `--radius-xl` | `20px` | Feed cards |
| `--radius-full` | `9999px` | Badges, pills, avatars |

---

## Shadows

```css
/* Card (feed) */
box-shadow: 0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);

/* Card hover */
box-shadow: 0 6px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05);

/* Primary button */
box-shadow: 0 3px 12px rgba(22,163,74,0.30);

/* Sidebar card */
box-shadow: 0 2px 14px rgba(0,0,0,0.05);

/* Nav */
box-shadow: 0 1px 12px rgba(0,0,0,0.06);
```

---

## Components

### Navigation Bar
- Background: `#ffffff`, `border-bottom: 1px solid #f3f4f6`
- Height: `60px`, sticky top
- Logo: image `assets/logo.jpeg` (36×36) + gradient wordmark
- Links: default `color: #6b7280`, active: `color: #16a34a; background: #f0fdf4`
- Primary CTA: gradient button (Post a Request)
- Notification bell + avatar on right

### Feed Card
```
┌─────────────────────────────┐
│ [Avatar] Name · Verified    │ [Badge]
│ City · time ago             │
├─────────────────────────────┤
│                             │
│     Photo / visual          │
│                             │
│     📍 Location pill        │
├─────────────────────────────┤
│ Title (H3, bold)            │
│ Caption text (13px)         │
│ #tag1 #tag2                 │
├─────────────────────────────┤
│ [Offer Help] 💬 N  Share    │
├─────────────────────────────┤
│ [dot] Comment preview       │
│ View all N comments         │
└─────────────────────────────┘
```

### Buttons
```css
/* Primary — use for main CTA (Offer Help, Post a Request) */
background: linear-gradient(135deg, #16a34a, #2563eb);
color: #fff; border: none;
padding: 9px 20px; border-radius: 10px;
box-shadow: 0 3px 12px rgba(22,163,74,0.30);

/* Secondary */
background: #f0fdf4; color: #16a34a;
border: 1px solid #bbf7d0;
padding: 9px 16px; border-radius: 10px;

/* Ghost */
background: none; color: #6b7280; border: none;
padding: 8px 12px; border-radius: 9px;
```

### Inputs & Selects
```css
border: 1.5px solid #e5e7eb; border-radius: 10px;
padding: 10px 14px; font-size: 13px;
background: #fff;

/* Focus */
border-color: #16a34a;
box-shadow: 0 0 0 3px rgba(22,163,74,0.12);
```

### Category Badges
```html
<span class="badge badge-urgent">🆘 Urgent</span>
<span class="badge badge-medicine">💊 Medicine</span>
<span class="badge badge-shelter">🏠 Shelter</span>
<span class="badge badge-food">🍱 Food</span>
<span class="badge badge-finance">💸 Financial</span>
```
All badges: `font-size: 11px; font-weight: 700; padding: 4px 11px; border-radius: 20px;`

### Verification Badge
```html
<span class="vbadge">✓ Verified</span>
```
`font-size: 10px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0;`

### Avatars
Gradient background, initials, `border-radius: 50%`. Use brand green for helpers, red for urgent posters, blue for others.

### Stories Row
Instagram-style circles at top of feed. Active/new: gradient ring. Seen: `#e5e7eb` ring.

### Filter Chips
`display: inline-block; padding: 5px 12px; border-radius: 20px; border: 1.5px solid #e5e7eb;`  
Active: gradient background, white text.

---

## Page Layout

```
[Nav — full width, sticky]
[Max-width: 1000px, centered]
  [Feed column — 1fr] | [Sidebar — 300px]
    Stories row
    Card stack          Filter chips
                        Stats
                        Suggested helpers
```

---

## What to AVOID

- Teal/clinical colour schemes
- White-on-teal navigation
- Heavy medical iconography (crosses, pulse lines)
- Dense data tables in primary views
- Low-contrast grey-on-grey text
- Shadows that are too heavy or coloured teal (old palette)

---

## Assets

| File | Use |
|---|---|
| `assets/logo.jpeg` | Full logo with heart icon + wordmark |

Favicon: crop to just the heart from `logo.jpeg`.
