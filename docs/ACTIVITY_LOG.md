# HealAll — Activity Log

Newest entries at the top. Each agent adds one entry at the end of a task. See `CLAUDE.md` → "Before You Finish — Log What You Did" for the format and rules.

---

## 2026-04-21 — Tasks 4–11: Design system rollout (feed, auth pages)
**Agent**: coder (claude-sonnet-4-6)
**Scope**: Wire FeedCard, FeedSidebar, and CategoryBubbles into a real feed layout; polish login/signup/verify-otp/posts pages with logo, real copy, and no Module-X labels.
**Changes**:
- `frontend/components/feed/feed-card.tsx`: new — avatar gradient, category emoji badge, 16:9 emoji photo area, "Offer Help" / "Share" action row, urgency pill.
- `frontend/components/feed/feed-sidebar.tsx`: new — search input, urgency chips (All/High/Critical), city select, community stats panel, recent helpers list.
- `frontend/app/feed/page.tsx`: full refactor — drops old inline card grid; uses `CategoryBubbles` + `FeedCard` list + `FeedSidebar` in `feed-layout` 2-col grid; `applyFilter` helper drives live re-fetch; `AuthRequired` guard hoisted to top-level early return.
- `frontend/app/login/page.tsx`: return block replaced — centered card (400px max), logo + wordmark header, real copy ("Welcome back"), ghost Resend OTP button.
- `frontend/app/signup/page.tsx`: return block replaced — 440px card, invite-only purple notice banner, inline "I want to…" role checkboxes with real labels.
- `frontend/app/verify-otp/page.tsx`: full replacement — 6 individual digit inputs with auto-focus-next / backspace-focus-prev, green highlight on filled cells, Clear button, logo header.
- `frontend/app/posts/new/page.tsx`: return block replaced — back link, section headers (WHAT DO YOU NEED / DETAILS / LOCATION), emoji category options, unused `postCategories`/`postUrgencies` imports removed.
- `frontend/app/posts/[postId]/page.tsx`: return block replaced — feed-card style author header with avatar gradient + vbadge, "Send Message" CTA, Comments section with compact card style, Report section with ghost submit, "Back to feed" link; all "Module X" labels removed.
**Tests**: `npm run build` — zero TypeScript/Next.js errors after each task.
**Follow-ups**: Task 12 (visual verification pass) pending.

---

## 2026-04-21 — Bugfix: role casing + case_verifier nav
**Agent**: coder (claude-sonnet-4-6)
**Scope**: Fix two bugs in AppShell nav: uppercase role strings never matched backend lowercase enums, and case_verifier users had no nav link to their primary page.
**Changes**:
- `frontend/components/layout/app-shell.tsx`: Role checks lowercased to match backend `UserRole` enum (`moderator`, `admin`, `head_admin`); new `isVerifier` check for `case_verifier`; `VERIFIER_LINKS` constant added with `/admin/verification`; `/admin/verification` removed from `ADMIN_LINKS`; `visibleLinks` spread now includes `VERIFIER_LINKS` tier between mod and admin tiers.
**Tests**: `npm run build` — zero errors.
**Follow-ups**: none.

---

## 2026-04-21 — Task 1: Logo + AppShell nav
**Agent**: coder (claude-sonnet-4-6)
**Scope**: Replace AppShell with role-gated nav, gradient logo wordmark, and fix teal inline styles.
**Changes**:
- `frontend/public/logo.jpeg`: new — copied from `assets/logo.jpeg`; served as `/logo.jpeg` by Next.js.
- `frontend/components/layout/app-shell.tsx`: full replacement — `<img>` + `.logo-text` gradient wordmark replaces `<strong>HealAll>`; inline `style={{ color: '#0f766e' }}` replaced with `className="active"`; flat `appLinks` array split into `BASE_LINKS` / `MOD_LINKS` / `ADMIN_LINKS`; `isAuthed` guest branch simplified to Sign up + Login only; user badge uses `.vbadge` class.
**Tests**: TypeScript build (`npm run build`) produced zero errors.
**Follow-ups**: Task 2 (Export FeedFilters type).

---

## 2026-04-20 — Task 1: Fix failing tests (make test green)
**Agent**: coder (claude-sonnet-4-6)
**Scope**: Fix two HTTP status code bugs in `main.py` exception handlers; all 108 integration tests now pass.
**Changes**:
- `backend/app/main.py`: `RequestValidationError` handler now returns 422 (was 400); `InvalidStateException` split out to return 409 Conflict (was grouped with `ValidationException` → 422).
**Tests**: 108/108 passed. `make test` green.
**Follow-ups**: Task 7 (Aadhaar real provider). Frontend wiring for upload presigned URLs.

---

## 2026-04-19 — CLAUDE.md rework + activity log introduced
**Agent**: coder (sonnet-4.6)
**Scope**: Rewrite `CLAUDE.md` to be less strict / more judgment-based, add a cross-session activity log requirement, provide an improved onboarding prompt for fresh agents.
**Changes**:
- `CLAUDE.md`: replaced blanket NEVER/ALWAYS rules with a "Working Style" section; added "When in Doubt" lookup table, "Likely First Tasks", and "Before You Finish — Log What You Did" section.
- `docs/ACTIVITY_LOG.md`: new file — handoff log for future agents (this entry is the seed).
- Removed dead claude-flow / ruflo MCP config from `.mcp.json`.
- Committed and pushed `backend/app/main.py` (slowapi import fix) + `backend/pyproject.toml` (hatch wheel config) as commit `8375cbb` on `development`.
**Tests**: not run — changes were docs/config only.
**Follow-ups**: none. Next agent should start with the CLAUDE.md "Likely First Tasks" list — most leverage is wiring `GET /v1/feed`.

---

## 2026-04-19 — Tasks 2–6 implementation (Task 1 pending Docker)
**Agent**: coder (claude-sonnet-4-6)
**Scope**: OTP background dispatch, MinIO presigned upload routes, GitHub Actions CI, Sentry init, full lint cleanup.
**Changes**:
- `backend/app/api/v1/auth.py`: OTP notifications moved to FastAPI BackgroundTasks; db.commit() now happens before dispatch so response returns fast; removed unused import.
- `backend/app/api/v1/uploads.py`: new — 3 presigned PUT URL endpoints (`/profile-photo`, `/post-attachment`, `/identity-document`).
- `backend/app/api/v1/router.py`: register uploads router.
- `backend/app/schemas/upload.py`: new — `PresignedUploadRequest` / `PresignedUploadResponse`.
- `backend/app/services/upload_service.py`: new — boto3 presigned URL generation + key helpers per entity type.
- `backend/app/main.py`: `sentry_sdk.init()` gated on `SENTRY_DSN` — no-op in dev/test.
- `backend/pyproject.toml`: extended ruff ignore list for false positives (ARG001 for FastAPI/slowapi, T201 for seed script, N818/B008/UP042/RET504 style).
- `backend/app/api/v1/{cases,posts,comments,messages}.py`: fixed B904 — all raise-in-except now use `from None`.
- `backend/app/api/v1/feed.py`: fixed C401 — set comprehension.
- `backend/app/worker/tasks.py`: fixed B904 — `raise self.retry(...) from exc`.
- `.github/workflows/ci.yml`: new — GitHub Actions lint + test with postgres:15 + redis:7.
- `docs/superpowers/plans/2026-04-19-tasks-1-6.md`: new — implementation plan.
**Tests**: Docker not running — tests not executed. `ruff check app/` passes clean. App imports verified.
**Follow-ups**: Task 1 (fix failing tests) needs Docker — start Docker Desktop, `make up && make test`, fix app code bugs found. Task 7 (Aadhaar stub → real). Frontend wiring for upload presigned URLs.

---
