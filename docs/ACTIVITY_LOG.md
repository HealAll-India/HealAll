# HealAll — Activity Log

Newest entries at the top. Each agent adds one entry at the end of a task. See `CLAUDE.md` → "Before You Finish — Log What You Did" for the format and rules.

---

## 2026-05-01 — Prometheus + Grafana metrics (Phase 4.3)
**Agent**: claude-sonnet-4-6
**Scope**: Expose /metrics from FastAPI and add a local monitoring stack with pre-built dashboard and alert rules.
**Changes**:
- `backend/pyproject.toml`: Added `prometheus-fastapi-instrumentator>=7.0.0`.
- `backend/app/main.py`: Wired `Instrumentator` — exposes `/metrics`, excludes `/health` and `/metrics` from instrumentation, gated by `METRICS_ENABLED`.
- `backend/app/core/config.py`: Added `METRICS_ENABLED: bool = True` setting.
- `backend/docker-compose.yml`: Added `prometheus` + `grafana` services under `monitoring` profile; added `prometheus_data` + `grafana_data` volumes.
- `backend/Makefile`: Added `make monitoring` target.
- `monitoring/prometheus.yml`: Scrapes `host.docker.internal:8000/metrics` every 15s.
- `monitoring/alerts.yml`: Three alert rules — `HighErrorRate` (5xx >5%, 2m), `HighLatency` (p95 >2s, 5m), `APIDown` (up==0, 1m).
- `monitoring/grafana/provisioning/`: Auto-provision Prometheus datasource + dashboard path.
- `monitoring/grafana/dashboards/healall.json`: Pre-built 6-panel dashboard (request rate, error %, latency percentiles, in-flight, slowest handlers, top handlers by volume).
**Tests**: ruff check + format clean. No DB-dependent tests (no schema changes). CI will verify on PR.
**Follow-ups**: Set `GRAFANA_ADMIN_PASSWORD` in local `.env` before running `make monitoring`. On Railway, `/metrics` is publicly accessible — add IP allowlist or basic auth if needed in production.

## 2026-04-28 — Fix GoogleOAuthProvider prerender crash (PR #13)
**Agent**: claude-sonnet-4-6
**Scope**: Fix `next build` crash on `/login` when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset.
**Changes**:
- `frontend/components/GoogleAuthProvider.tsx`: Removed conditional bare-children fallback. Always renders `<GoogleOAuthProvider clientId={clientId}>` so the context is available during static prerender. All 17 pages now generate cleanly.
**Tests**: `npm run build` ✓ (was crashing), `npm run lint` ✓, `npm run typecheck` ✓.
**Follow-ups**: Merge PR #13. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel + `GOOGLE_CLIENT_ID` in Railway for Google OAuth to work in production.

---

## 2026-04-26 — Privacy Policy and Terms of Service pages
**Agent**: claude-sonnet-4-5
**Scope**: Add /privacy-policy and /terms pages required for Google OAuth verification + footer links.
**Changes**:
- `frontend/app/privacy-policy/page.tsx`: Privacy Policy — data collected, usage, sharing (Google OAuth, Resend, Neon), rights, cookies, contact
- `frontend/app/terms/page.tsx`: Terms of Service — eligibility, community rules, content policy, disclaimers, governing law (India)
- `frontend/components/layout/app-shell.tsx`: added footer with Privacy Policy, Terms, Community Guidelines, Contact links
**Tests**: no backend changes; TS + ESLint clean
**Follow-ups**: submit for Google OAuth verification at console.cloud.google.com/apis/credentials/consent; verify healallindia.com in Google Search Console

---

## 2026-04-26 — Google OAuth signup and login
**Agent**: claude-sonnet-4-5
**Scope**: Add Google OAuth as primary auth method (invite-code still required). OTP flow preserved at /signup/otp.
**Changes**:
- `backend/alembic/versions/20260426_0000_007_add_google_sub_to_users.py`: new migration — adds nullable `google_sub` column (unique, indexed) to `users` table
- `backend/app/models/user.py`: added `google_sub: Mapped[str | None]` field
- `backend/app/core/config.py`: added `GOOGLE_CLIENT_ID: str | None` setting
- `backend/pyproject.toml`: added `google-auth>=2.28.0` and `requests>=2.31.0` deps
- `backend/app/schemas/auth.py`: added `GoogleSignupRequest` and `GoogleLoginRequest` schemas
- `backend/app/services/google_auth_service.py`: new service — `verify_google_token`, `create_google_user`, `resolve_google_login`, `link_google_sub`
- `backend/app/api/v1/google_auth.py`: new endpoints — `POST /v1/auth/google/signup` and `POST /v1/auth/google/login`
- `backend/app/api/v1/router.py`: registered `google_auth` router
- `backend/app/services/email_templates.py`: added community guidelines link to welcome email
- `backend/tests/test_google_auth.py`: 8 tests covering signup, duplicate checks, login, linking, unknown user
- `frontend/components/GoogleAuthProvider.tsx`: new `GoogleOAuthProvider` wrapper (no-op if `NEXT_PUBLIC_GOOGLE_CLIENT_ID` unset)
- `frontend/app/layout.tsx`: wrapped with `GoogleAuthProvider`
- `frontend/app/signup/page.tsx`: refactored to 3-state machine (invite → phone → feed); Google-first
- `frontend/app/signup/otp/page.tsx`: new — OTP signup preserved at `/signup/otp`
- `frontend/app/login/page.tsx`: Google button above OTP form with divider
- `frontend/lib/api/auth.ts`: added `googleSignup` and `googleLogin` functions
- `frontend/lib/types/api.ts`: added `GoogleSignupRequest`, `GoogleLoginRequest`, `GoogleAuthResponse` types
**Tests**: 8 new Google OAuth tests pass; existing 108 tests unaffected
**Follow-ups**: Set `GOOGLE_CLIENT_ID` in Railway and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel after creating GCP OAuth credentials (see plan Task 0 / Pre-flight)

---

## 2026-04-25 — Auto-login after OTP verification + CI fixes
**Agent**: claude-sonnet-4-7
**Scope**: Fix two signup flow bugs: email not sent on production, no auto-login after OTP verification.
**Changes**:
- `backend/app/schemas/auth.py`: `VerifyOTPResponse` gains optional `access_token`, `token_type`, `expires_in`, `user` fields.
- `backend/app/api/v1/auth.py`: `verify_otp` endpoint now calls `create_tokens()` when `verification_level >= 1` and populates token fields in response. Fully verified users auto-login in one round-trip.
- `frontend/app/verify-otp/page.tsx`: After successful OTP verification, if `access_token` present → `setSession()` → redirect to `/feed`. No extra manual login step.
- `frontend/lib/types/api.ts`: `VerifyOtpResponse` extended with optional token fields.
- `backend/app/services/email_templates.py`: ruff format fix (string concat style).
- `backend/app/api/v1/auth.py`: ruff I001 import sort fix.
- Railway: triggered redeploy to activate `RESEND_API_KEY` env var (set previously, not yet live).
**Tests**: CI passing (Lint & Test ✅, frontend lint ✅, Vercel ✅). Manual test pending after PR merge + Railway deploy.
**Follow-ups**: Merge PR #10 → Railway auto-deploys main → email + auto-login both live.

## 2026-04-25 — Real logo in email + favicon generation
**Agent**: claude-sonnet-4-7
**Scope**: Replace emoji logo in email with actual HealAll heart icon; generate favicons for website.
**Changes**:
- `frontend/public/favicon.ico` + `favicon-{16,32,48,64,128,256,512}.png` + `apple-icon.png` (new): Cropped from `logo.jpeg` — just the heart/hands icon, no text, white padding, generated with Pillow.
- `frontend/app/layout.tsx`: Added full favicon metadata (16/32/64px PNG + ICO + 180px apple-touch), OpenGraph tags, improved title/description.
- `backend/app/services/email_templates.py`: Logo pill replaced with `<img src="https://healallindia.com/favicon-128.png">` (72×72, rounded corners).
**Tests**: Email sent to anupamkumar.nith@gmail.com — 200 OK.
**Follow-ups**: Deploy Vercel (favicon live at healallindia.com/favicon-128.png once pushed). Open PR to merge feat/branded-email-templates.

## 2026-04-25 — Resend email setup + branded HTML email templates
**Agent**: claude-sonnet-4-7
**Scope**: Wire Resend as email provider in Railway; build branded HTML OTP + welcome email templates matching HealAll design system.
**Changes**:
- `backend/app/services/email_templates.py` (new): HTML email templates — `otp_email()` and `welcome_email()`. Table-based layout, inline styles, email-client safe. Matches globals.css design: green/blue gradient bar, DM Sans, `#16a34a`/`#2563eb` brand, OTP code in green `#f0fdf4` box, security warning in amber, footer with `healallindia.com`.
- `backend/app/services/notification_service.py`: `send_otp_email()` and `send_welcome_email()` now use HTML templates from `email_templates.py`. `ResendProvider.send_email()` detects HTML body and sends `html` + `text` fallback. `SMTPProvider._build_message()` upgraded to `MIMEMultipart("alternative")` for HTML emails.
- Railway env vars set (via CLI): `RESEND_API_KEY`, `SMTP_FROM_EMAIL=noreply@healallindia.com`, `SMTP_FROM_NAME=HealAll`. Domain `healallindia.com` verified in Resend dashboard.
**Tests**: Manual — sent test OTP email to anupamkumar.nith@gmail.com from `noreply@healallindia.com` via Resend API, returned 200. HTML renders correctly with brand styling.
**Follow-ups**: Redeploy Railway backend to pick up new env vars. Consider HTML preview in Celery tasks (tasks.py still sends plain text subject/body — would need update if Celery worker deployed).

## 2026-04-24 — Fix signup 422: auto-normalize phone to E.164 (PR #9)
**Agent**: claude-sonnet-4-6
**Scope**: Signup was returning 422 Unprocessable Content when users entered bare 10-digit phone numbers.
**Changes**:
- `frontend/app/signup/page.tsx`: In `handleSubmit`, normalize phone before API call — strip whitespace/dashes/parens, prepend `+91` if not already present. Updated placeholder to clarify both `9999999999` and `+919999999999` formats work.
**Tests**: Manual — 422 reproduced with bare number, confirmed fix normalizes to `+917876302026` before sending.
**Follow-ups**: none

---

## 2026-04-24 — Fix production API URL + Vercel deploy pipeline
**Agent**: claude-sonnet-4-6
**Scope**: Fix frontend hitting localhost:8000 in production; fix Vercel hook root directory; remove ruvnet co-author from git history.
**Changes**:
- Vercel project env: Added `NEXT_PUBLIC_API_BASE_URL=https://api.healallindia.com` for `production` + `preview` targets — was missing, causing all API calls to fall back to `localhost:8000`.
- Vercel project settings: Set `rootDirectory=frontend` via REST API — hook-triggered deployments now build from the correct subdirectory instead of failing at 0ms.
- Git history: Removed `Co-Authored-By: claude-flow <ruv@ruv.net>` from 2 early commits via `git filter-repo`; force-pushed main. ruvnet no longer appears in GitHub contributors graph (cache clears within hours).
**Tests**: `curl healallindia.com` confirmed Developer Contribution section live. API URL fix verified by inspecting Vercel env vars.
**Follow-ups**: Never use `vercel --prod` from `frontend/` dir — `rootDirectory=frontend` causes CLI to double the path. Always deploy via git push to main (hook fires automatically).

---

## 2026-04-24 — Upgrade GitHub Actions to Node.js 20 (PR #7)
**Agent**: claude-sonnet-4-6
**Scope**: Bump deprecated @v4 actions to @v5 across all CI workflows before GitHub's June 2026 Node.js 16/18 retirement.
**Changes**:
- `.github/workflows/backend-ci.yml`: `actions/checkout@v4` → `@v5`; `codecov/codecov-action@v4` → `@v5` (adds `token: ${{ secrets.CODECOV_TOKEN }}`; `continue-on-error: true` already present so public repo still works without secret).
- `.github/workflows/ci.yml`: `actions/checkout@v4` → `@v5`.
- `.github/workflows/frontend-ci.yml`: `actions/checkout@v4` → `@v5`; `actions/setup-node@v4` → `@v5`.
- `.github/workflows/security-scan.yml`: `actions/checkout@v4` → `@v5`; `actions/setup-node@v4` → `@v5`.
- `docs/ACTIVITY_LOG.md`: Added missing entry for PR #6 (ESLint/ruff/test fixes).
**Tests**: No logic change — CI correctness verified by workflow syntax; deprecation warnings eliminated.
**Follow-ups**: Set `CODECOV_TOKEN` secret in GitHub repo settings if private coverage uploads are needed.

---

## 2026-04-24 — Fix CI lint failures (PR #6)
**Agent**: claude-sonnet-4-6
**Scope**: Unblock frontend and backend CI pipelines after Next.js 16 upgrade and ruff formatting drift.
**Changes**:
- `frontend/eslint.config.mjs`: Created ESLint 9 flat config (`[...nextConfig]`) — Next.js 16 dropped `next lint`, requires flat config file.
- `frontend/package.json`: Changed `"lint": "next lint"` → `"lint": "eslint ."` — `next lint` removed in Next.js 16.
- `frontend/lib/hooks/use-hydrated.ts`: Added `eslint-disable-next-line react-hooks/set-state-in-effect` — false positive on `setHydrated(true)` inside `useEffect`.
- `backend/tests/integration/test_messages.py`: Fixed ruff C405 (`set([...])` → `{...}`) and N817 (`InviteCode as IC` → `InviteCode`).
- `backend/tests/` (all files): `ruff check --fix` + `ruff format` — fixed import ordering (I001) and formatting drift across 69 files.
- `backend/tests/integration/test_auth_flow.py`: Updated `test_complete_auth_flow` — phone is auto-verified at signup so `pending_verification` no longer contains `"phone"`; removed phone OTP creation and verification steps.
**Tests**: All CI checks green on PR #6 before merge. 108/108 passing.
**Follow-ups**: Vercel auto-deploy not triggered after merge — manual `vercel --prod` needed.

---

## 2026-04-24 — Add developer contribution section to landing page
**Agent**: claude-sonnet-4-6
**Scope**: New static card on landing page showcasing open-source contribution for developers.
**Changes**:
- `frontend/app/page.module.css`: Added `.contribute*` CSS classes — card with dark-to-blue accent bar, header, two-panel grid, tech stack items, contribution area coloured pills, footer, and responsive breakpoint (stacks to 1 col at ≤600px).
- `frontend/app/page.tsx`: Added `<section className={s.contribute}>` after guidelines section — tech stack list (FastAPI, Next.js, PostgreSQL+Redis, Railway+Vercel) + contribution areas grid (Frontend, API, Tests, Docs) + GitHub CTA + README.md link. riseIn animation with 0.45s delay.
**Tests**: `npm run build` → `✓ Compiled successfully`. Zero TypeScript or CSS module errors.
**Follow-ups**: none

---

## 2026-04-23 — Fix Sentry errors: Resend email provider + bcrypt pin
**Agent**: claude-sonnet-4-6
**Scope**: Fix 2 Sentry-reported production errors from Railway logs.
**Changes**:
- `backend/app/core/config.py`: Added `RESEND_API_KEY: str | None = None` setting.
- `backend/app/services/notification_service.py`: Added `ResendProvider` (HTTPS POST to api.resend.com — bypasses Railway's SMTP port block). Added `MSG91ResendProvider` (MSG91 for SMS + Resend for email). Updated `_select_provider()` to prefer Resend over SMTP: Resend+MSG91 > Resend > WhatsApp+SMTP > WhatsApp > MSG91+SMTP > MSG91 > SMTP > Console.
- `backend/pyproject.toml`: Pinned `bcrypt>=4.0.1,<4.1` (was `<5`) to fix passlib 1.7.4 incompatibility with bcrypt≥4.1 (`__about__` attribute removed).
**Tests**: `from app.services import notification_service` imports cleanly. Docker not running — full suite skipped.
**Follow-ups**: User must sign up at resend.com, verify healall.in domain, get API key, set `RESEND_API_KEY` in Railway. Then Railway redeploy picks up both fixes.

---

## 2026-04-22 — Fix WhatsApp provider: async scope, error return, template support
**Agent**: claude-sonnet-4-6
**Scope**: Four code-review fixes to `WhatsAppProvider` in notification_service.py.
**Changes**:
- `backend/app/services/notification_service.py`: (1) Moved `resp.status_code` check inside the `async with httpx.AsyncClient` block — reading `.text` outside the block causes `ResponseClosed` on non-200 responses. (2) Non-200 branch now returns `False` instead of falling back to console, matching `MSG91Provider` pattern (console fallback remains only in the `except Exception` path). (3) `send_sms` now checks `self._template_name`; when set, builds a Meta-approved template payload (OTP extracted via regex) instead of a `type: "text"` payload — required for production unsolicited messages. `__init__` reads the new setting. (4) `send_email` now logs before delegating to console fallback.
- `backend/app/core/config.py`: Added `WHATSAPP_OTP_TEMPLATE_NAME: str | None = None` setting after `WHATSAPP_PHONE_NUMBER_ID`.
**Tests**: `ruff check` passes on both files. No new unit tests (HTTP mocking out of scope; covered by manual integration test with sandbox number).
**Follow-ups**: Set `WHATSAPP_OTP_TEMPLATE_NAME=healall_otp` in Railway env once Meta template is approved.

---

## 2026-04-23 — Add WhatsApp OTP provider via Meta Cloud API
**Agent**: claude-sonnet-4-6
**Scope**: Add `WhatsAppProvider` and `WhatsAppSMTPProvider` to `notification_service.py`; update `_select_provider()` to prefer WhatsApp when configured.
**Changes**:
- `backend/app/services/notification_service.py`: Added `WhatsAppProvider` (Meta Cloud API v20.0, E.164 → digits-only, console fallback on error); added `WhatsAppSMTPProvider` (delegates SMS to WhatsApp, email to SMTP); updated `_select_provider()` to check `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` first, before MSG91, preserving existing fallback chain.
**Tests**: `ruff check` passes. No unit tests added (provider covered by integration flow; mocking a live HTTP API is out of scope). Full test suite not run (Docker not up).
**Follow-ups**: Add `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` to Railway env vars to activate. Settings stubs for these vars must exist in `app/core/config.py` (Task 1 prerequisite).

---

## 2026-04-23 — Production readiness: Celery OTP wiring + notification tasks + repo housekeeping
**Agent**: claude-sonnet-4-6
**Scope**: Wire OTP delivery through Celery, implement case/comment notification task bodies, update CLAUDE.md and gitignore.
**Changes**:
- `backend/app/api/v1/auth.py`: Replace FastAPI `BackgroundTasks` with Celery `.delay()` for OTP SMS/email in `signup` and `resend_otp`. Gives retry-with-backoff on delivery failure. Removes `BackgroundTasks` import/param from both routes.
- `backend/app/worker/tasks.py`: Implement real bodies for `notify_case_update` and `notify_new_comment` — fetch user contact info from DB via `async_session_maker`, dispatch via `notification_service.send_sms/send_email`.
- `.gitignore`: Add `/plans/` so local planning files aren't tracked.
- `CLAUDE.md`: Fix branch reference (`development` → `main`), add production URL header, replace stale "7 Remaining Tasks" with accurate "Production Config" checklist.
**Tests**: Syntax + ruff lint clean. Full suite skipped (Docker not running); last green run 108/108 on 2026-04-20. No DB schema changes.
**Follow-ups**: Run `make test` with Docker to confirm Celery task dispatch doesn't break signup tests. User must set Railway env vars (SENTRY_DSN, MSG91_API_KEY, SMTP_*) and add Celery worker service.

---

## 2026-04-22 — Full production deploy: healallindia.com live
**Agent**: claude-sonnet-4-6
**Scope**: Deploy frontend to Vercel, wire custom domains, DNS on Cloudflare.
**Changes**:
- Vercel: deployed `frontend/` as `anupamkumarnith-1461s-projects/frontend`, env `NEXT_PUBLIC_API_BASE_URL=https://api.healallindia.com`
- Vercel domains: added `healallindia.com` + `www.healallindia.com`
- Cloudflare DNS: A records `@` + `www` → `76.76.21.21` (Vercel), CNAME `api` → `m9eweo1y.up.railway.app` (Railway)
- Railway: updated `APP_ALLOWED_ORIGINS` to include healallindia.com + www + Vercel deploy URLs
**Tests**: `GET https://api.healallindia.com/health` → `{"status":"healthy"}`. `GET https://healallindia.com` → 200, Vercel CDN hit. DB migration v006 confirmed.
**Follow-ups**: www cert auto-provisioning (in progress). Add invite code to seed data for first user signup test. Consider enabling Cloudflare proxy back on www A record once cert is ready.

---

## 2026-04-22 — Railway deployment: migrations live, backend healthy
**Agent**: claude-sonnet-4-6
**Scope**: Fix Railway deploy chain so migrations run on startup and backend is reachable at healall-production.up.railway.app.
**Changes**:
- `backend/alembic/env.py`: Read DATABASE_URL from env; strip `sslmode=` (psycopg2 syntax) and pass `ssl='require'` via connect_args for asyncpg.
- `backend/app/db/session.py`: Same sslmode→connect_args fix so app engine also works with Neon.
- `backend/Dockerfile`: Change CMD from `uvicorn` directly to `bash start.sh` — Railway uses Dockerfile over nixpacks.toml, so migrations were bypassed.
**Tests**: `alembic_version = 006` (head) confirmed in Neon. All 20 app tables created. `GET /health` → `{"status":"healthy","version":"0.1.0"}`.
**Follow-ups**: Add api.healallindia.com custom domain in Railway → Cloudflare CNAME. Deploy frontend to Vercel. DNS for healallindia.com.

---

## 2026-04-21 — Homepage hero landing page
**Agent**: coder (claude-sonnet-4-6)
**Scope**: Replace dev placeholder at `/` with proper hero landing page.
**Changes**:
- `frontend/app/page.tsx`: centered hero — large logo + wordmark, headline, "Join HealAll" / "Sign in" CTAs, invite note, 6 category pills.
**Tests**: `npm run build` — zero errors.
**Follow-ups**: none.

---

## 2026-04-21 — Tasks 1–3: AppShell nav + shared types + CategoryBubbles
**Agent**: coder (claude-sonnet-4-6)
**Scope**: First three tasks of design system rollout — nav component, shared type, first feed component.
**Changes**:
- `frontend/public/logo.jpeg`: copied from `assets/logo.jpeg` so Next.js serves it as `/logo.jpeg`
- `frontend/components/layout/app-shell.tsx`: full replacement — gradient logo img + wordmark, role-gated nav (BASE_LINKS / VERIFIER_LINKS / MOD_LINKS / ADMIN_LINKS tiers), active link uses `className="active"` not inline style; role strings lowercased to match backend enum; `case_verifier` gets its own Verify link tier
- `frontend/lib/types/api.ts`: exported `FeedFilters` interface `{ city, category, urgency, search: string }` for shared use by feed page + sidebar
- `frontend/components/feed/category-bubbles.tsx`: new — 7 emoji bubbles mapping backend category values to UI; active state via border + scale + glow; scrollable row
**Tests**: `npm run build` — zero errors after each commit.
**Follow-ups**: Tasks 4–11 (feed components + page polishes) — see entry below.

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
