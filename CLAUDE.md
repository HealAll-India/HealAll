# HealAll — Agent Guide

HealAll is an invite-only, volunteer-driven mutual-aid platform for India. Web-only. Users post help requests, verified volunteers respond, moderators keep it safe.

**Repo**: `https://github.com/anupam8nith/HealAll.git` · branch `development`
**Deep-dive docs** (read when relevant, not always): `docs/ROADMAP.md`, `docs/CODE_REVIEW.md`, `docs/HealAll_Architecture_README_v1.md`

---

## Stack at a Glance

- **Backend**: Python 3.12, FastAPI, SQLAlchemy async, Alembic, PostgreSQL 15, Redis 7, MinIO
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind, Zustand, TanStack Query
- **Tests**: pytest-asyncio (`asyncio_mode = "auto"`)
- **Lint**: `ruff` (BE), ESLint + tsc (FE)

---

## Where Things Live

```
backend/app/
  api/v1/       # Route handlers (one file per domain)
  services/     # Business logic + DB access
  models/       # SQLAlchemy ORM
  schemas/      # Pydantic request/response
  core/         # config.py, security.py, exceptions.py, deps.py, limiter.py
  db/           # engine, session, seed script
  workers/      # Celery tasks (designed, not started)
backend/alembic/versions/   # 6 migrations, dated
backend/tests/integration/  # 10 test files
frontend/app/               # Next.js pages
frontend/lib/api/           # Typed API client — one file per domain
frontend/lib/stores/        # Zustand
```

---

## What's Done and What Isn't

**Done**: all backend modules (auth, users, posts, cases, messages, comments, reports, moderation, invites), all 6 migrations, all frontend pages, full API client, 10 integration test files written.

**Stubbed / Missing**:
- **Notifications** — `notification_service.py` logs to console. MSG91 and SMTP config exist in `Settings` but aren't wired.
- **Aadhaar verification** — `verification_service.py` is a stub.
- **Celery workers** — files exist but nothing runs them.
- **File uploads** — MinIO runs in compose, no presigned-URL routes.
- **Public feed route** — `post_service.get_feed()` is complete and filter-rich, but *no route calls it*. `GET /v1/posts` returns only the caller's own posts. **Often the first real task an agent should tackle.**
- **CI/CD, Sentry, Prometheus** — not set up.
- **Input validation gaps** — `AddSkillRequest.skill`, `SendMessageRequest.body`, `CreateCommentRequest.body` have no `max_length`.

---

## Architecture You Need to Know

### Auth flow
1. Admin creates `InviteCode` in DB (no public API).
2. `POST /v1/auth/signup` with invite code → unverified user.
3. `POST /v1/auth/verify-otp` (phone, then email) → `verification_level` increments.
4. `POST /v1/auth/token` → access JWT (15 min) + refresh token in httpOnly cookie (30 days).
5. Roles: `help_seeker` (default), `volunteer`, `verifier`, `moderator`, `admin`, `head_admin`.

### RBAC
- `deps.py` → `require_any_role([...])` is the FastAPI dependency.
- Checks happen at **both** the route and service layer (defence-in-depth — keep it that way).
- Moderators can't act on users with `MODERATOR` / `ADMIN` / `HEAD_ADMIN` roles.

### Post status lifecycle
```
draft | needs_info  →  submitted  →  active  →  resolved
                                  ↘  rejected
```
- `GET /v1/feed` returns only `active` posts.
- `GET /v1/posts/{id}` — non-owner gets 404 unless status is `active` or `resolved`.

### Case status lifecycle
```
active | reopened  →  closure_requested  →  closed
                   ↘  closed (verifier direct)
closed  →  reopened  (verifier/admin only)
```
- Helpers cannot join cases in `closure_requested` or `closed`.

### Service-layer contract (important)
- **Services don't commit.** They call `db.add()` / `db.flush()` / `db.refresh()`.
- **Routes commit.** Route handler calls `await db.commit()` after the service call.
- **Services don't raise HTTPException.** They raise from `app.core.exceptions` (`NotFoundException`, `ForbiddenException`, `ValidationException`, `InvalidStateException`, etc). A global handler in `main.py` maps them to HTTP codes.

### Test auth pattern (non-obvious — save yourself time)
Do **not** drive the signup API in tests. Instead:
```python
# Seed invite directly
invite = InviteCode(code="TEST-XXXX", ...); db.add(invite); await db.commit()

# Get plaintext OTP without mocking
otp_plain = await auth_service.create_otp(db, user, "phone")

# Admin role: set User.roles directly in DB (signup doesn't allow admin role)
# Feed tests: seed Post with status=PostStatus.ACTIVE.value directly via ORM
# Cases: no POST /v1/cases endpoint — seed Case + Post via ORM
```
`conftest.py` already has fixtures for this.

---

## Security Regressions Already Fixed — Don't Re-Introduce

Details in `docs/CODE_REVIEW.md`. Short version:

| Bug | File | Guard that's there now |
|-----|------|------------------------|
| Non-owners could read draft/submitted/rejected posts | `api/v1/posts.py` | Visibility check: 404 unless `active`/`resolved` or owner |
| 500 when post author is soft-deleted | `api/v1/posts.py` | `scalar_one_or_none()` + explicit 404 |
| User could report themselves | `services/report_service.py` | Self-report guard |
| Moderator could suspend admins | `services/moderation_service.py` | Role-hierarchy check |
| Helpers could join `CLOSURE_REQUESTED` cases | `services/case_service.py` | Guard rejects `CLOSURE_REQUESTED` + `CLOSED` |

When editing those files, keep the guards intact.

---

## Commands

```bash
# Backend (run from /backend)
make up          # Start Docker: postgres + redis + minio
make migrate     # alembic upgrade head
make dev         # uvicorn on :8000
make test        # pytest
make test-cov    # pytest + coverage
make lint        # ruff check
make format      # ruff format
make seed        # Load seed data
make worker      # Celery worker (when you're ready to use it)

# Frontend (run from /frontend)
npm run dev      # Next.js on :3000
npm run build
npm run lint
```

---

## Seed Data

- Admin: `admin@healall.in` / `+919999999999`
- Invite codes: `HEAL-DEMO001`, `HEAL-TEMP001`
- Test DB: `healall_test` (same creds as dev)

---

## Working Style

**Keep files under ~500 lines.** If one grows past that, split along the natural seam.

**Prefer editing over creating.** If a new domain concept genuinely warrants a new file, go ahead — but don't fragment things that belong together.

**Migrations are immutable once applied.** Never edit a file in `alembic/versions/`. If the schema needs to change, add a new migration.

**Run tests on anything you touch.** `make test` for the backend. If you change a route, also hit the endpoint manually or write a new test case.

**Don't commit secrets.** `.env` is gitignored — keep it that way.

**Parallelise independent reads.** If you need to look at 4 files to understand a change, batch the `Read` calls in one message. Same for independent `Bash` commands.

**When the task is ambiguous, pick the smallest version first.** Ship that, then iterate. Don't grow scope silently.

---

## Before You Finish — Log What You Did

Every agent, every task, one small write before you hand off: append an entry to `docs/ACTIVITY_LOG.md`. This is how future agents (and the human) pick up without re-deriving context.

**When to write it**: the very last thing, after tests pass and the task is actually done. Skip it only if you made zero changes (pure investigation / Q&A).

**Format** — append to the top, newest-first:
```markdown
## YYYY-MM-DD — <short task title>
**Agent**: <model/role — e.g., "coder (sonnet-4.6)">
**Scope**: <one line: what was asked>
**Changes**:
- <file or area>: <what changed, why>
- <file or area>: <what changed, why>
**Tests**: <`make test` passed / N new tests added / skipped because …>
**Follow-ups**: <anything intentionally left undone — or "none">
```

Keep it tight — 5–10 lines per entry. This is a handoff note, not a story. If the change touched the security-sensitive files listed above, call that out explicitly so the next reviewer can sanity-check the guards.

---

## When in Doubt

| Situation | Where to look |
|-----------|--------------|
| "What's the shape of X API?" | `backend/app/api/v1/X.py` then `schemas/X.py` |
| "What state transitions are allowed?" | The relevant `services/*_service.py` file |
| "Is this endpoint auth-gated?" | `deps.py` + the route's `Depends(...)` |
| "Did we already fix a bug here?" | `docs/CODE_REVIEW.md` |
| "What's next on the roadmap?" | `docs/ROADMAP.md` |
| "Is there already a frontend client for this?" | `frontend/lib/api/*.ts` |
| "How do I write a test that needs an authed user?" | `backend/tests/conftest.py` + the auth pattern above |

---

## Likely First Tasks

In rough order of leverage:

1. **Wire `GET /v1/feed`** — create a route in `api/v1/feed.py` that calls `post_service.get_feed()`. Filter-rich public feed; the service is already done.
2. **Close the input validation gaps** — add `max_length` to skill / message body / comment body schemas. 15 minutes of work.
3. **Make `make test` green** — the integration tests exist but may not all pass. Fix the actual bugs (not the tests) where possible.
4. **Wire real notifications** — MSG91 for SMS, SMTP for email. Config already exists in `Settings`.
5. **Start Celery** — move OTP dispatch off the request thread. `make worker` is ready.
6. **CI** — `.github/workflows/ci.yml` with lint + test. Docker service for postgres/redis.
7. **Sentry** — `sentry-sdk` is in deps; just init it in `main.py` using `SENTRY_DSN`.
