# HealAll — Activity Log

Newest entries at the top. Each agent adds one entry at the end of a task. See `CLAUDE.md` → "Before You Finish — Log What You Did" for the format and rules.

---

## 2026-05-17 — Profile polish: privacy alignment + India state/city picker
**Agent**: claude-opus-4-7
**Scope**: User reported (1) misaligned privacy checkboxes on `/profile`, (2) free-text city field should be a state + city dropdown with India data, (3) audit other forms.
**Root cause**: Global `input { width: 100% }` rule in `globals.css` was stretching every input — including checkboxes/radios — to full width, breaking flex alignment on the privacy section.
**Changes**:
- `frontend/app/globals.css`: Scoped text-input styles via `input:not([type="checkbox"]):not([type="radio"]):not([type="file"])` so checkboxes/radios keep native sizing. Added `accent-color: var(--brand-green)` + explicit 16px sizing for checked-state polish.
- `frontend/components/ui/india-location-picker.tsx` (new): Cascading state → city `<select>` pair. Uses `country-state-city` package (India: 36 states/UTs, ~5k cities prebuilt). Fully controlled, no internal effect-based state sync (passes React 19 `set-state-in-effect` rule). Emits `"City, State"` string upward so existing API/DB stay unchanged. Backward compatible with legacy free-text values.
- `frontend/app/profile/page.tsx`: Replaced 1-col `<input>` city with `<IndiaLocationPicker>`. Restructured grid layout (Name now full-width, picker spans full row).
- `frontend/app/posts/new/page.tsx`: Same picker replacing free-text city.
- `frontend/app/signup/page.tsx`: Same picker; restructured layout (phone row alone, picker below).
- `frontend/app/signup/otp/page.tsx`: Same picker.
- `frontend/package.json`: Added `country-state-city@^3.2.1`.
**Tests**: `npx tsc --noEmit` clean, `npx eslint` clean, `npm run build` green.
**Follow-ups**: Consider lazy-loading the city list per state (currently bundled — adds ~150KB gzipped, acceptable for India-only).

---

## 2026-05-17 — Post location + community verification voting
**Agent**: claude-opus-4-7
**Scope**: User reported (1) post created → submitted for verification → feed shows 0 posts (confusing), (2) need community-verification path (not just admins), (3) every post should require nearest-landmark address + optional Google-Maps-style pin, (4) location info mandatory.
**Design decisions (from user)**:
- Verification model: **voting** — N approvals from verified L1+ helpers → auto-flip to ACTIVE.
- Map provider: **OpenStreetMap + Leaflet** (free, no API key).
- Required fields: `address` + `pincode` (lat/lng optional via map pin).
- Backward compat: columns nullable on DB; API enforces on new posts only.
**Changes**:
- `backend/alembic/versions/008_*.py` (new): add `address/pincode/latitude/longitude` to `posts`; create `post_verification_votes` table with `UNIQUE(post_id, voter_id)` to prevent double-voting.
- `backend/app/models/post.py`: add new Post fields + `PostVerificationVote` ORM + `VoteDecision` enum.
- `backend/app/schemas/post.py`: `CreatePostRequest`/`UpdatePostRequest` now require address (3-300 chars) + India pincode (regex `^[1-9][0-9]{5}$`). Optional lat/lng with paired-or-neither validator. `PostResponse` and `PostSummary` carry location fields.
- `backend/app/services/post_service.py`: store new fields on create.
- `backend/app/services/community_verification_service.py` (new): list pending (excluding own + already-voted), tally vote summary, cast vote with guards (self-vote, re-vote, voter must be L1+, post must be SUBMITTED). On reaching `COMMUNITY_VERIFY_THRESHOLD` APPROVE votes, flip post to ACTIVE + create Case.
- `backend/app/schemas/community_verification.py` (new) + `backend/app/api/v1/community_verification.py` (new): `GET /v1/community-verification/queue`, `POST /v1/community-verification/{post_id}/vote`. Registered in `router.py`.
- `backend/app/core/config.py`: `COMMUNITY_VERIFY_THRESHOLD: int = 3`.
- `frontend/components/ui/map-picker.tsx` + `map-picker-inner.tsx` (new): Leaflet wrapper with `next/dynamic({ ssr: false })`. Click to pin, click "Clear pin" to unset. Read-only mode for display.
- `frontend/app/posts/new/page.tsx`: form now requires address + 6-digit pincode + optional map pin. Surfaces real backend error messages (kept from previous PR).
- `frontend/app/posts/[postId]/page.tsx`: new "Location" card showing address, city, pincode, and read-only map if coordinates set.
- `frontend/app/verify/page.tsx` (new): community voting UI — pending posts, vote tally, approve/reject/needs_info buttons with optional reason. Gated to L1+ users.
- `frontend/app/feed/page.tsx`: surface user's own pending posts in a banner so they don't think the submission was lost.
- `frontend/components/layout/app-shell.tsx`: nav link to `/verify` for all authed users.
- `frontend/lib/api/community-verification.ts` (new): typed client.
- `frontend/lib/types/api.ts`: new location fields on `CreatePostPayload`, `PostResponse`, `PostSummary`.
- `frontend/package.json`: add `leaflet@^1.9.4` + `react-leaflet` + `@types/leaflet`.
**Tests**: Pydantic schema validators tested via direct Python import (pincode regex, lat/lng pairing). Frontend `tsc --noEmit` clean, `eslint` clean, `npm run build` green. Backend integration tests need Docker DB — will run on CI.
**Migration safety**: All new columns nullable; legacy posts won't fail. Migration is additive only — no destructive ops.
**Follow-ups**:
- Threshold (3) is env-configurable via `COMMUNITY_VERIFY_THRESHOLD` on Railway.
- Geocoding (typing an address → auto-fill map) deferred — would need Nominatim or similar.
- Voter abuse — currently UNIQUE(post_id, voter_id) prevents re-voting; consider reputation decay for repeat reckless votes.

---

## 2026-05-17 — Auto-recover from expired/invalid auth tokens
**Agent**: claude-opus-4-7
**Scope**: Production users seeing 401s on /feed, /cases, /conversations, /me + "Failed to create post" on submit. Root cause: stale `accessToken` persisted in localStorage from prior session; backend (JWT secret rotated or token TTL exceeded) rejects with 401. Frontend had no recovery path — silently retried with bad token forever.
**Changes**:
- `frontend/lib/api/client.ts`: On 401 response, dispatch `auth:expired` CustomEvent on window before throwing ApiError. Lets app layer auto-clear stale token.
- `frontend/components/layout/app-shell.tsx`: useEffect listener for `auth:expired` — calls `clearSession()` then `router.replace("/login?reason=expired")`. Guard against double-fire when token already cleared.
- `frontend/app/login/page.tsx`: Read `?reason=expired` from window.location (avoids `useSearchParams` Suspense requirement) and show banner "Your session expired. Please sign in again."
- `frontend/app/posts/new/page.tsx`: Improved error fallback. Non-ApiError now shows `Network error: <msg>. Check your connection and try again.` instead of generic "Failed to create post".
**Tests**: `npm run build` clean. TS + ESLint clean. Manually verified the 401 → redirect → banner flow logic. Production fix unlocks any user stuck with a stale token without requiring manual localStorage clear.
**Follow-ups**: Consider a "refresh token" rotation flow so users don't get bounced to login on every JWT secret rotation. None blocking.

---

## 2026-05-17 — Add CodeRabbit config + Copilot instructions
**Agent**: claude-opus-4-7
**Scope**: Land CodeRabbit auto-review config on default branch + add Copilot Chat/completion project instructions. Fixes "Configuration used: defaults / Auto reviews disabled" message on prior PRs (config must live on the default branch to take effect).
**Changes**:
- `.coderabbit.yaml` (new): assertive review profile, custom tone (sardonic), PR summary template, path filters, 17 path-specific instructions (immutable migrations, service-layer contract, RBAC guards, schema PII, frontend Next.js 16 rules, test discipline), `base_branches` includes main + development + feat/fix/chore/docs patterns so non-default bases auto-review, knowledge base reads `CLAUDE.md` + `docs/CODE_REVIEW.md` + `docs/ROADMAP.md`.
- `.github/copilot-instructions.md` (new): Project context, hard rules (never push main, immutable migrations, no secrets), service-layer contract, security guards, schema discipline, frontend rules, test patterns, infra quirks (Railway SMTP, bcrypt pin), commit/PR style. Read by Copilot Chat + completions.
**Tests**: Config-only — no code change.
**Follow-ups**: After merge, verify next PR shows custom CodeRabbit summary (not "defaults"). Copilot bot still requires paid Pro+/Business subscription for PR review feature.

---

## 2026-05-17 — Address CodeRabbit review feedback on PR #30
**Agent**: claude-opus-4-7
**Scope**: Apply 5 CodeRabbit findings on the hsec landing redesign.
**Changes**:
- `frontend/app/globals.css`: Added scoped `.pdf-page h3/p/ul/li` styles so child elements render correctly inside 220px preview tiles (CodeRabbit blocker — children inherited body defaults).
- `frontend/app/page.tsx`: ARIA on `.pdf-scroll` (region) and `.pdf-page` (article + aria-label). Fixed Download buttons to use `/uc?export=download&id=…` instead of `/view`. Bumped tech-stack label "Next.js 15" → "Next.js 16".
- `.github/workflows/copilot-review.yml`: Added explicit `contents: read` per workflow-permissions guideline.
**Tests**: TS/lint not runnable in worktree; Vercel preview validates.
**Follow-ups**: none.

---

## 2026-05-17 — Landing info sections redesign (hsec design system)
**Agent**: claude-opus-4-7
**Scope**: Implement Community Guidelines + Developer Contribution sections from Anthropic design bundle (`HealAll Prototype.html`).
**Changes**:
- `frontend/app/page.tsx`: Replaced CSS-module-based Guidelines + Contribute sections with global `.hsec` classes. Community Guidelines now uses a 4-card horizontal `.pdf-scroll__rail` + embedded `.pdf-viewer` iframe. Developer Contribution uses dark `.hsec` variant with `.stack-item` + `.area-item` tone variants (green/blue/purple/orange).
- `frontend/app/globals.css`: Added `.hsec*`, `.pdf-scroll*`, `.pdf-page*`, `.pdf-viewer*`, `.contrib-col*`, `.stack-item*`, `.area-item*` classes (+ mobile breakpoint).
**Tests**: TS/lint not runnable locally (worktree has no node_modules); changes are scoped to page.tsx + globals.css. Vercel preview will validate.
**Follow-ups**: Verify Copilot review bot fires on this PR (testing review workflow).

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
