# GitHub Copilot — HealAll Project Instructions

These instructions apply to Copilot Chat, code completions, and PR review for `HealAll-India/HealAll`.
Hard rules are non-overridable. Non-hard guidance may be overridden only when explicitly requested in chat.

---

## Project context

**HealAll** — invite-only mutual-aid platform, India-first, web-only.

- **Production**: healallindia.com (frontend, Vercel) · api.healallindia.com (backend, Railway) · Neon PostgreSQL + Upstash Redis
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy async + PostgreSQL 15 + Redis 7 + MinIO + Celery
- **Frontend**: Next.js 16 (App Router) + TypeScript + CSS Modules + Zustand
- **Tests**: pytest-asyncio with `asyncio_mode = "auto"`; tests hit real DB (`healall_test`), no mocks

---

## Hard rules (never violate)

1. **Never push directly to `main`.** Always create a feature branch (`feat/`, `fix/`, `chore/`, `docs/`) and open a PR.
2. **Migrations in `backend/alembic/versions/` are immutable.** Never edit an existing migration file — add a new one for any schema change.
3. **Never commit secrets.** `.env` is gitignored. Use `.env.example` for placeholder values.
4. **No `--no-verify`, no hook skips, no `dangerouslySetInnerHTML` without sanitization.**

---

## Service-layer contract (backend)

When generating or modifying code in `backend/app/services/**`:

- Services call `db.add()`, `db.flush()`, `db.refresh()` — **never** `db.commit()`. Routes commit.
- Services raise from `app.core.exceptions` — **never** raise `HTTPException`. The global handler in `main.py` maps to HTTP codes.
- RBAC checks live at **both** route and service layer (defence-in-depth). Keep both.

### Security guards — preserve these

| File | Guard |
|------|-------|
| `services/report_service.py` | Self-report blocked (user cannot report own content) |
| `services/moderation_service.py` | Moderators cannot act on `MODERATOR` / `ADMIN` / `HEAD_ADMIN` roles |
| `services/case_service.py` | Helpers cannot join cases in `CLOSURE_REQUESTED` state |
| `api/v1/posts.py` | Visibility check on non-public reads; soft-delete guard uses `scalar_one_or_none()` |

---

## Schema discipline (backend)

`backend/app/schemas/**`:

- **Response schemas MUST NOT include**: `password_hash`, `refresh_token`, `otp_code`, internal IDs, soft-delete flags.
- Use `Field(exclude=True)` or a separate `Read` schema.
- Input schemas use `EmailStr`, `PhoneNumber` validators.

---

## Frontend rules

- Next.js 16 App Router. **Server components by default** — add `"use client"` only when the component needs interactivity.
- Never put secrets or tokens in client components.
- Use the typed API client in `frontend/lib/api/*.ts` — not raw `fetch`.
- Image components: use `next/image`, not raw `<img>`.
- ESLint 9 flat config (`eslint.config.mjs`) — don't reintroduce `.eslintrc`.

---

## Testing rules (backend)

`backend/tests/**`:

- **No DB mocking.** Tests hit `healall_test` PostgreSQL.
- Test auth pattern (see `backend/tests/conftest.py`):
  - Create `InviteCode` directly in DB (no signup API call)
  - Call `auth_service.create_otp(db, user, "phone")` directly to get plaintext OTP
  - Phone is auto-verified at signup — only email OTP needed post-signup
  - Admin role: set on `User.roles` directly in DB (signup doesn't allow admin role)
- Feed tests: seed `Post` with `status=PostStatus.ACTIVE.value` via ORM.
- Cases: no `POST /v1/cases` endpoint — seed `Case` + `Post` via ORM.
- No `@pytest.mark.skip` without a linked issue. No bare `assert True`. No `time.sleep()` — use proper waits.

---

## Infrastructure quirks (production)

- **Railway blocks SMTP ports 25/465/587** — use `ResendProvider` (HTTPS to api.resend.com, port 443).
- **bcrypt pinned `>=4.0.1,<4.1`** in `backend/pyproject.toml`. passlib 1.7.4 breaks on bcrypt ≥4.1 (removed `__about__`). **Never** remove the upper bound.
- **Celery worker is a separate Railway service** — code is in `backend/app/worker/`, command: `celery -A app.worker.celery_app worker --loglevel=info`.

---

## Coding style

- **Files under ~500 lines.** Split at natural seams.
- **Default to writing no comments.** Only add a comment when the WHY is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug.
- **No marketing language** in code, comments, or commit messages ("seamlessly", "robust", "leverage", "powerful").
- **No vague hedging**: "might want to consider", "perhaps you could". State directly.
- Prefer **editing existing files** over creating new ones.
- Parallelise independent operations.

---

## Commits & PRs

- Branch naming: `feat/`, `fix/`, `chore/`, `docs/` prefixes.
- Commit subjects ≤50 chars. Body explains "why", not "what".
- After any task with file changes, write to `docs/ACTIVITY_LOG.md` as the **last step**.
- Use Conventional Commits style (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

### Activity log format

```markdown
## YYYY-MM-DD — <title>
**Agent**: <model/role>
**Scope**: <one line>
**Changes**: <file: what + why, one bullet per file>
**Tests**: <result or why skipped>
**Follow-ups**: <undone work or "none">
```

---

## Quick navigation

| Question | Where |
|----------|-------|
| API shape | `backend/app/api/v1/X.py` → `schemas/X.py` |
| State transitions | `services/*_service.py` |
| Auth-gating | `deps.py` + route `Depends(...)` |
| Past bugs fixed | `docs/CODE_REVIEW.md` |
| Roadmap | `docs/ROADMAP.md` |
| Frontend API client | `frontend/lib/api/*.ts` |
| Last agent's work | `docs/ACTIVITY_LOG.md` |
| Test auth fixtures | `backend/tests/conftest.py` |

---

## Don'ts

- ❌ Don't suggest `git push` to `main`.
- ❌ Don't edit existing Alembic migrations.
- ❌ Don't use `db.commit()` inside a service function.
- ❌ Don't raise `HTTPException` from a service.
- ❌ Don't mock the database in tests.
- ❌ Don't include sensitive fields in response schemas.
- ❌ Don't use `--no-verify` on git commands.
- ❌ Don't pin npm packages to `*` or `latest`.
- ❌ Don't reintroduce `.eslintrc` (project uses flat config).
- ❌ Don't use raw `<img>` in Next.js — use `next/image`.
