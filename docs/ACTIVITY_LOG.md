# HealAll — Activity Log

Newest entries at the top. Each agent adds one entry at the end of a task. See `CLAUDE.md` → "Before You Finish — Log What You Did" for the format and rules.

---

## 2026-05-17 — Fix CodeQL missing-workflow-permissions findings
**Agent**: claude-sonnet-4-6
**Scope**: Add explicit `permissions: contents: read` blocks to all 4 workflow files missing them.
**Changes**:
- `.github/workflows/backend-ci.yml`: Added `permissions: contents: read` — resolves CodeQL `actions/missing-workflow-permissions` finding.
- `.github/workflows/ci.yml`: Added `permissions: contents: read` — same fix.
- `.github/workflows/frontend-ci.yml`: Added `permissions: contents: read` — same fix.
- `.github/workflows/security-scan.yml`: Added `permissions: contents: read` — fixes both python-audit and npm-audit job findings (7 total CodeQL alerts resolved).
**Tests**: No functional change — permissions block only restricts default token scope to read-only.
**Follow-ups**: none

---

## 2026-05-17 — Design system v2 implementation (Claude Design handoff)
**Agent**: claude-opus-4-7
**Scope**: Implement the HealAll design system produced by Claude Design, covering CSS tokens, component patterns, feed card, nav, and a new heart-mark asset.
**Changes**:
- `frontend/app/globals.css`: Added category border color tokens (`--urgent-border`, etc.); spacing/type/line-height/weight CSS vars; motion vars (`--ease-out`, `--duration-fast`, `--duration-base`); `--shadow-focus-ring`; `--gradient-brand-soft`; upgraded badges to `inline-flex` with border per category; new `.alert` block component (success/error/info with icon slot); new `.modal` / `.modal-backdrop`; `.feed-card__media--*` per-category tinted gradients; `.bubble-msg` chat bubble classes; `.eyebrow` label class; `.btn-sm` / `.btn-lg` size modifiers; `.card--sidebar` variant; `.chip` hover-color transition; all transitions updated to use `--duration-fast` + `--ease-out`.
- `frontend/components/feed/feed-card.tsx`: Category-tinted media area (different gradient bg per category); bordered badges for all 6 category types; `♥ Offer Help` button label; title hover color via inline handlers; unified `CATEGORY_META` map.
- `frontend/components/layout/app-shell.tsx`: Nav logo now uses `heart-mark.png` div (green glow ring shadow) instead of `logo.jpeg`; authenticated nav gets "+ Post a Request" gradient CTA button.
- `frontend/public/heart-mark.png`: Clean heart-mark raster asset from the design system (padded, safe at any corner radius).
- `docs/design/HEALALL_DESIGN_BRIEF.md` (new): 20-section master design brief for sharing with Claude Design or external designers.
**Tests**: `npm run lint` — clean (0 errors); `npx tsc --noEmit` — clean.
**Follow-ups**: Alert blocks (`.alert.success` / `.alert.error`) still need to be wired into existing page components that use `p.error` / `p.success` text — those still work but are less prominent. Modal component is CSS-only; no React wrapper yet. Heart-mark SVG version needed when available.

---

## 2026-05-04 — Messages UI overhaul
**Agent**: claude-sonnet-4-6
**Scope**: Replace placeholder messages pages with a real conversation list and chat-bubble thread UI.
**Changes**:
- `frontend/app/messages/page.tsx`: Rewritten — clean conversation list with `ConvCard` component showing the other participant (truncated ID), time-ago timestamp, and empty state. Removed the raw-UUID accept/decline form (no list-pending-requests endpoint exists). Single `useEffect` data-fetch pattern.
- `frontend/app/messages/[conversationId]/page.tsx`: Rewritten — chat-bubble layout with green bubbles for outgoing, grey for incoming. Header with back-arrow and participant label. Auto-scrolls to latest message. Disabled input when conversation is ended. Restores typed text on send failure.
**Tests**: `npm run lint` clean, `tsc --noEmit` clean.
**Follow-ups**: Add a "Request DM" button on post pages; add pending consent request list once a backend endpoint exists.

---

## 2026-05-04 — Profile UI overhaul + Copilot auto-review workflow
**Agent**: claude-sonnet-4-6
**Scope**: Replace placeholder profile page with a proper UI; add GitHub Actions workflow to auto-request Copilot review on every PR to main.
**Changes**:
- `frontend/app/profile/page.tsx`: Rewritten — profile header with avatar (initials fallback), verification level badge, role pills, email/phone verified indicators. Edit form uses 2-col grid for name/city. Skills shown as blue pill chips with Enter-to-add support. Privacy section has description text per setting. Single `saving` flag consolidates loading state across all actions.
- `.github/workflows/copilot-review.yml` (new): Triggers on PR open/reopen/ready-for-review targeting main. Adds `Copilot` as a reviewer via `gh pr edit --add-reviewer`. Requires `pull-requests: write` permission; uses `GITHUB_TOKEN`. Skips draft PRs.
**Tests**: `npm run lint` clean, `tsc --noEmit` clean.
**Follow-ups**: Copilot auto-review requires GitHub Copilot code review to be enabled for the repository (Settings → Copilot → Code review). The workflow will fail silently if not enabled.

---

## 2026-05-04 — Cases UI overhaul
**Agent**: claude-sonnet-4-6
**Scope**: Replace placeholder cases pages with proper case list and detail UI.
**Changes**:
- `frontend/app/cases/page.tsx`: Rewritten — `CaseCard` with colour-coded status badge (open=blue, in_progress=amber, pending_closure=orange, closed=gray, invalid=red), urgency colour, helper count, city/category metadata, total count header, empty state linking to feed.
- `frontend/app/cases/[caseId]/page.tsx`: Rewritten — full detail page with back-link, header (title, status badge, metadata row, owner name), "Offer Help" action (only shown for active cases), "Reopen" (only shown for closed), notes section (chronological with time-ago stamps), add-note form, closure section with resolution type dropdown and remarks (hidden for closed cases). `withAction` helper consolidates loading/error state across async actions.
**Tests**: `npm run lint` clean, `tsc --noEmit` clean.
**Follow-ups**: Add "Request DM" button to case detail when consent messaging is surfaced from post pages.

---

## 2026-05-04 — Fix Google OAuth button mobile alignment
**Agent**: claude-sonnet-4-6
**Scope**: Google sign-in/sign-up button overflowed container on narrow mobile screens due to hardcoded pixel widths.
**Changes**:
- `frontend/app/login/page.tsx`: Replaced `width="340"` with a `ResizeObserver` ref that measures the container and passes the live pixel width to `<GoogleLogin>`. Container gets `overflow: hidden` to prevent bleed.
- `frontend/app/signup/page.tsx`: Same pattern — replaced `width="376"` with dynamic measurement from a ref.
**Tests**: `npm run lint` clean, `tsc --noEmit` clean.
**Follow-ups**: none.

---
