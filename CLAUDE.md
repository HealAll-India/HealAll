# HealAll — Agent Guide

Invite-only mutual-aid platform, India-first, web-only. **Repo**: `https://github.com/anupam8nith/HealAll.git` · branch `main`
**Production**: healallindia.com (frontend, Vercel) · api.healallindia.com (backend, Railway) · Neon PostgreSQL + Upstash Redis

Deep-dive docs (read when relevant): `docs/ROADMAP.md`, `docs/CODE_REVIEW.md`, `docs/HealAll_Architecture_README_v1.md`

---

## Non-Obvious Rules

**Service-layer contract**: services call `db.add()` / `db.flush()` / `db.refresh()` — never `db.commit()`. Routes commit. Services raise from `app.core.exceptions`, never `HTTPException`. Global handler in `main.py` maps to HTTP codes.

**RBAC is defence-in-depth**: checks live at both route and service layer. Keep both. Moderators cannot act on `MODERATOR` / `ADMIN` / `HEAD_ADMIN` roles.

**Migrations are immutable**: never edit `alembic/versions/`. Add a new migration for any schema change.

**Tests need Docker running**: `make up` before `make test`. Tests hit a real DB (`healall_test`) — no mocks.

**Test auth pattern** — don't drive the signup API. Instead:
```python
invite = InviteCode(code="TEST-XXXX", ...); db.add(invite); await db.commit()
otp_plain = await auth_service.create_otp(db, user, "phone")
# Admin role: set User.roles directly in DB
# Feed tests: seed Post with status=PostStatus.ACTIVE.value via ORM
# Cases: no POST /v1/cases endpoint — seed Case + Post via ORM
```
`conftest.py` has fixtures for this.

**Security guards — don't remove**: see `docs/CODE_REVIEW.md` for full list. Key files: `api/v1/posts.py` (visibility check, soft-delete guard), `services/report_service.py` (self-report guard), `services/moderation_service.py` (role-hierarchy check), `services/case_service.py` (closure state guard). If you touch these files, verify guards are intact.

---

## Working Style

- Files under ~500 lines. Split at natural seams.
- Prefer editing over creating.
- Smallest version first. No silent scope creep.
- Parallelise independent reads and Bash calls.
- Don't commit secrets. `.env` is gitignored.

---

## Activity Log — Mandatory

Write to `docs/ACTIVITY_LOG.md` as the **last step** of every task that made changes. Past agents have skipped this — don't. Future agents depend on it.

```markdown
## YYYY-MM-DD — <title>
**Agent**: <model/role>
**Scope**: <one line>
**Changes**: <file: what + why, one bullet per file>
**Tests**: <result or why skipped>
**Follow-ups**: <undone work or "none">
```

---

## Commands

```bash
# from /backend
make up && make migrate   # first-time setup
make dev                  # API on :8000
make test / make test-cov
make lint / make format
make seed

# from /frontend
npm run dev               # :3000
npm run build / npm run lint
```

---

## Production Status

All backend code complete. 108/108 tests pass. Production live since 2026-04-20.

### Done ✅
- Tests green (108/108)
- Notifications: MSG91 + SMTP provider pattern in `services/notification_service.py`
- Celery: `worker/celery_app.py` + `worker/tasks.py`; OTP tasks wired via `.delay()`
- File uploads: presigned-URL routes in `api/v1/uploads.py` (profile, post, identity)
- CI: 4 workflows in `.github/workflows/`
- Sentry: conditional init in `main.py` (needs `SENTRY_DSN` env var in Railway)

### Remaining — Production Config (user action in Railway)
1. **Set `SENTRY_DSN`** — create project at sentry.io → Python/FastAPI → copy DSN
2. **Set MSG91 vars** — `MSG91_API_KEY`, `MSG91_TEMPLATE_ID_OTP` from msg91.com dashboard
3. **Set SMTP vars** — `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (e.g. Postmark or Gmail)
4. **Add Celery worker service on Railway** — same repo, command: `celery -A app.worker.celery_app worker --loglevel=info`
5. **Production object storage** — set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT_URL` for MinIO or S3
6. **Aadhaar verification** — `verification_service.py` is a stub; wire DigiLocker API when ready

---

## Dev Tools

**Session workflow**: brainstorm → graphify query → plan → TDD → code → commit → review

- **graphify**: `graphify-out/GRAPH_REPORT.md` before architecture questions. Auto-updates on file write. Run `graphify hook install` once per machine (git hooks).
- **mempalace**: 957-drawer MCP memory. `mempalace mine <dir>` for new files.
- **episodic-memory**: `/episodic-memory:search-conversations` before "how to approach X" questions.
- **caveman**: `/caveman:caveman-commit`, `/caveman:caveman-review`.
- **superpowers**: brainstorm (`superpowers:brainstorming`) → plan (`superpowers:writing-plans`) → review (`superpowers:requesting-code-review`).
- **review-loop**: `/review-loop:review-loop` after significant implementations.

---

## Quick Navigation

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
