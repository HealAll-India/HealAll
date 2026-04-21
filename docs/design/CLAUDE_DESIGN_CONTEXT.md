# Claude Design Context — HealAll

Paste this block at the top of any Claude conversation about HealAll UI/frontend work.

---

## Who You Are Designing For

HealAll is an **India-first community mutual-aid platform** (invite-only, web-only). Users post requests for help (blood, medicine, shelter, food, money) and community members offer assistance. Think Instagram + GoFundMe + neighbourhood WhatsApp group — warm, human, community-first.

**NOT** a hospital app, insurance platform, or corporate product. Avoid clinical/sterile aesthetics.

---

## Stack

- Next.js 15 (App Router), TypeScript, vanilla CSS (no Tailwind, no shadcn/ui)
- CSS custom properties defined in `frontend/app/globals.css`
- Font: DM Sans (`font-family: 'DM Sans', system-ui, -apple-system, sans-serif`)
- No component library — write semantic HTML + CSS using the tokens below

---

## Design Decisions Made

| Decision | Choice |
|---|---|
| Colour direction | Clean white + green-blue brand gradient |
| Component style | Elevated & Bold (shadows, gradient CTAs, 20px card radius) |
| Navigation | White top nav, teal-free, gradient logo wordmark |
| Feed style | Instagram-inspired — photo-first cards, stories row, comment preview |

---

## Brand Colours

```css
--gradient-brand:  linear-gradient(135deg, #16a34a, #2563eb)   /* primary CTAs, logo text, active states */
--brand-green:     #16a34a    /* left half of logo heart */
--brand-blue:      #2563eb    /* right half of logo heart */
```

Logo file: `assets/logo.jpeg` — green-blue split heart, two reaching hands, "HealAll" wordmark.

---

## Full Token Reference

```css
/* Backgrounds */
--bg:              #ffffff
--bg-subtle:       #f9fafb
--surface:         #ffffff

/* Borders */
--border:          #f3f4f6    /* card borders */
--border-strong:   #e5e7eb    /* inputs, form elements */

/* Text */
--text:            #111827    /* headings, primary */
--text-muted:      #6b7280    /* secondary, nav links */
--text-subtle:     #9ca3af    /* timestamps, captions */

/* Semantic */
--urgent:          #e11d48  --urgent-bg:   #fff1f2
--medicine:        #d97706  --medicine-bg: #fffbeb
--shelter:         #2563eb  --shelter-bg:  #eff6ff
--food:            #16a34a  --food-bg:     #f0fdf4
--finance:         #7c3aed  --finance-bg:  #faf5ff
--danger:          #e11d48
--ok:              #16a34a

/* Radius */
--radius-sm:   8px     /* chips */
--radius-md:   10px    /* buttons, inputs */
--radius-lg:   16px    /* sidebar cards */
--radius-xl:   20px    /* feed cards */
--radius-full: 9999px  /* badges, pills, avatars */

/* Shadows */
--shadow-card:       0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)
--shadow-card-hover: 0 6px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)
--shadow-btn:        0 3px 12px rgba(22,163,74,0.30)
--shadow-nav:        0 1px 12px rgba(0,0,0,0.06)
```

---

## Component Patterns

### Feed Card
```html
<div class="card">
  <!-- Header: avatar + name + verification + badge -->
  <!-- Photo area: aspect-ratio 1.6/1, emoji placeholder or <img> -->
  <!-- Body: title (15px 700) + caption (13px 400) + #tags -->
  <!-- Actions: [Offer Help btn] [💬 N] [Share] [✓ N helpers] -->
  <!-- Comment preview + "View all N comments" -->
</div>
```

### Primary Button
```css
background: var(--gradient-brand);
color: #fff; border: none;
padding: 9px 20px; border-radius: var(--radius-md);
box-shadow: var(--shadow-btn);
```

### Nav Active Link
```css
color: var(--brand-green);
background: #f0fdf4;
font-weight: 700;
border-radius: var(--radius-sm);
```

### Category Badge
```html
<span class="badge badge-urgent">🆘 Urgent</span>
<span class="badge badge-medicine">💊 Medicine</span>
<span class="badge badge-shelter">🏠 Shelter</span>
<span class="badge badge-food">🍱 Food</span>
<span class="badge badge-finance">💸 Financial</span>
```

### Verification Badge
```html
<span class="vbadge">✓ Verified</span>   <!-- Level 1+ -->
```

### Gradient Wordmark
```css
background: var(--gradient-brand);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
font-weight: 800;
```

---

## Layout

```
Nav (sticky, 60px, white + shadow)
└─ max-width: 1000px
   ├─ Feed column (1fr)
   │   ├─ Stories row (avatar circles, gradient rings)
   │   └─ Card stack
   └─ Sidebar (300px)
       ├─ Filter chips + city select
       ├─ Community stats
       └─ Suggested helpers
```

Mobile (<768px): single column, hide nav links (hamburger).

---

## Avoid

- `background: linear-gradient(135deg, #0f766e, ...)` — old teal palette, replaced
- `--primary: #0f766e` — use `--brand-green: #16a34a` instead
- Radial gradient on body background — use flat `#ffffff`
- Clinical/medical icons (pulse lines, red crosses)
- Dense data tables in primary views

---

## Full Design System Reference

See `docs/design/DESIGN_SYSTEM.md` for the complete spec with all component definitions, the feed card wireframe, and asset inventory.
