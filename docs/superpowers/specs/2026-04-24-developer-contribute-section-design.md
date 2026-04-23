# Developer Contribution Section — Design Spec

**Date:** 2026-04-24  
**Status:** Approved  
**Location:** Landing page (`frontend/app/page.tsx`), below Community Guidelines section

---

## What We're Building

A static card section on the landing page that signals HealAll is open source and shows developers how to get involved. No interactivity — pure informational UI.

---

## Layout

Two-panel card matching the existing page aesthetic (rounded card, top accent bar, same max-width as guidelines section: 680px).

### Structure (top to bottom)

1. **Top accent bar** — dark-to-blue gradient (`#111827 → #2563eb`), 3px height
2. **Header row** — dark icon box (🛠️), "Open Source" label + "Contribute as a Developer" title, "View on GitHub ↗" pill button (dark bg)
3. **Two-panel body**
   - Left: **Tech Stack** — 4 rows, each with emoji + name + subtitle
   - Right: **Contribution Areas** — 4 coloured pill rows (green, blue, purple, orange)
4. **Footer bar** — "⭐ Fork · open an issue · ship a PR" note + "Read README.md →" link (links to GitHub repo README)

---

## Content

### Tech Stack (left panel)
| Emoji | Name | Subtitle |
|-------|------|----------|
| ⚡ | FastAPI + SQLAlchemy | Python 3.12, async |
| ⚛️ | Next.js 15 | TypeScript, App Router |
| 🐘 | PostgreSQL + Redis | Neon, Upstash |
| 🚀 | Railway + Vercel | Backend + Frontend deploy |

### Contribution Areas (right panel)
| Emoji | Label | Colour |
|-------|-------|--------|
| 🎨 | Frontend UI & UX | Green (`#f0fdf4` / `#15803d`) |
| ⚙️ | API features | Blue (`#eff6ff` / `#1d4ed8`) |
| 🧪 | Tests & coverage | Purple (`#faf5ff` / `#7c3aed`) |
| 📝 | Docs & translations | Orange (`#fff7ed` / `#c2410c`) |

### Links
- **View on GitHub** → `https://github.com/anupam8nith/HealAll`
- **Read README.md** → `https://github.com/anupam8nith/HealAll/blob/main/README.md`

---

## Implementation Notes

- **Files to touch:** `frontend/app/page.tsx`, `frontend/app/page.module.css`
- Add a `<section className={s.contribute}>` block after the guidelines section
- Add `.contribute`, `.contributeCard`, `.contributeHeader`, `.contributeBody`, `.contributeFooter`, `.techStack`, `.contributionAreas` CSS classes in `page.module.css`
- Apply same `riseIn` animation as guidelines section (stagger with `animation-delay: 0.45s`)
- Mobile: two-panel grid collapses to single column at ≤600px (same breakpoint as guidelines)
- No new dependencies — pure HTML/CSS/TSX

---

## Out of Scope

- Interactive issue tracker or live GitHub stats
- Dark mode variants
- Animations beyond the existing riseIn
