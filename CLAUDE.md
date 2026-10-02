# HealAll — Agent Guide

Invite-only mutual-aid platform, India-first, web-only.
**Repo:** `https://github.com/HealAll-India/HealAll` · branch `main` (protected) · production live since 2026-04-20.
**Hosts:** `healallindia.com` (Vercel) · `api.healallindia.com` (Railway) · Neon PostgreSQL · Upstash Redis · S3 (AWS prod / MinIO dev).

Deep-dive docs (read on demand): `docs/ROADMAP.md`, `docs/CODE_REVIEW.md`, `docs/HealAll_Architecture_README_v1.md`, `infra/aws/cloudformation/README.md`.

---

## Non-Obvious Rules

**Service-layer contract.** Services call `db.add()` / `db.flush()` / `db.refresh()` — never `db.commit()`. Routes commit. Services raise from `app.core.exceptions`, never `HTTPException`. The global handler in `main.py` maps to HTTP codes.

**RBAC is defence-in-depth.** Checks live at both route and service layer. Keep both. Moderators cannot act on `MODERATOR` / `ADMIN` / `HEAD_ADMIN` roles. Self-acts (self-report, self-vote, comment-on-own-soft-deleted-post) are blocked at the service layer.

**Migrations are immutable.** Never edit `alembic/versions/`. Add a new migration for any schema change.

**Tests need Docker running.** `make up` before `make test`. Tests hit a real DB (`healall_test`) — no mocks.

**Test auth pattern** — don't drive the signup API. Instead:
```python
invite = InviteCode(code="TEST-XXXX", ...); db.add(invite); await db.commit()
otp_plain = await auth_service.create_otp(db, user, "phone")
# Admin role: set User.roles directly in DB
# Feed tests: seed Post with status=PostStatus.ACTIVE.value via ORM
# Cases: no POST /v1/cases endpoint — seed Case + Post via ORM
```
Fixtures live in `backend/tests/conftest.py`.

**Comments endpoint is post-status-gated.** `services/comment_service._get_visible_post` rejects any post not in `ACTIVE` / `RESOLVED` with 404 — even for the author. Frontend code that fetches `getPost` + `listComments` together must use `Promise.allSettled` and keep a nullable `comments` state (`null` = load failed, `[]` = empty thread).

**Frontend storage uploads use raw `fetch`.** `frontend/lib/api/uploads.ts::putToPresignedUrl` intentionally does **not** route through the shared `apiClient`. `apiClient` is wired for JSON body + Bearer token + `API_BASE_URL`-relative paths — all three break S3 presigned PUT (HMAC mismatch, absolute URL, raw bytes). Don't "fix" it.

**AI report triage is suggest-only (human-in-the-loop).** `services/triage_service.py` + `triage_llm.py` + `triage_masking.py`, routes in `api/v1/ai_triage.py`, table `report_triage` (migration 009). Rules:
- The AI never changes `Report.status` and never calls `moderation_service`. Only a moderator's decision writes `decided_by` / `decision` / `final_*` / `decided_at`, once per suggestion (409 on a second write).
- `reason=crisis` is **always** urgent, enforced in code (`triage_service.is_urgent`), never trusted to the model. The model's `imminent_danger=true` also forces urgent. `model_severity` keeps the raw model output for audit.
- Only the reported content text + report reason are sent, after `mask_pii` (emails, phones, Aadhaar-shaped IDs, URLs → host only, @handles). Never send reporter/target identities or the reporter's description. Never log content.
- Same hierarchy guard as moderation actions (moderators cannot triage reports about MODERATOR/ADMIN/HEAD_ADMIN, or about themselves); role check at route **and** service.
- On demand only (no worker): cached per `(report_id, content_hash)`; cache hits don't count towards the per-moderator hourly limit (`AI_TRIAGE_RATE_LIMIT_PER_HOUR`, Redis with in-process fallback).
- Any invalid/timeout/non-200 model output → `state: "no_suggestion"`. Bump `triage_llm.PROMPT_VERSION` when changing the prompt or schema.
- Flag off or no key → `GET /v1/moderation/triage/config` returns `enabled: false` and the UI renders nothing. Report list sorts crisis/AI-urgent first only while enabled.
- Tests stub `triage_llm._post_chat`; never hit a real provider in tests.

**Security guards — don't remove.** See `docs/CODE_REVIEW.md` for the full list. Key files: `api/v1/posts.py` (visibility check, soft-delete guard), `services/report_service.py` (self-report guard), `services/moderation_service.py` (role-hierarchy check), `services/case_service.py` (closure state guard). Touch these files → verify guards intact.

---

## Git Workflow — Mandatory

**Never push to `main` directly.** Every change:
1. `git checkout -b <type>/<short-description>` off `origin/main`.
2. Commit on the feature branch.
3. `gh pr create` with a body that includes a test plan.
4. Address CodeRabbit feedback (see below) until reviews pass.
5. Merge.

Branch prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `infra/`, `ci/`, `style/`.

**Branch deletion is automatic.** GitHub repo setting `delete_branch_on_merge=true` removes the head branch on merge. Local clones have `git config --global fetch.prune=true`, so `git fetch` auto-cleans remote-tracking branches. Local checkouts (`git branch`) still need manual `git branch -D` if you care.

---

## CodeRabbit Loop — Mandatory

When a CodeRabbit review lands on your PR:
- **"📝 Committable suggestion" block:** apply it verbatim, push, then for each `comment_id`:
  - `gh api repos/HealAll-India/HealAll/pulls/<N>/comments/<comment_id>/replies -f body="..."` — one-line reply describing the change and commit SHA.
  - Resolve via GraphQL: `gh api graphql -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread { isResolved } } }' -f id=<thread_id>` (find thread IDs with `repository.pullRequest.reviewThreads(first:50)`).
- **Plain "Refactor suggestion" / "Nitpick" without a committable block:** judgment call. Push back if the suggestion misreads the design (e.g., adding new tokens for a single use-site, routing presigned PUT through `apiClient`).
- **CodeRabbit "✨ Confirmed" / ack comments:** no action; do not reply.
- **CodeRabbit duplicate comments re-reviewing an older SHA:** no action; the thread is already resolved.
- **CI events that only show Vercel deploy status or "review in progress":** acknowledge and wait.

Same loop applies to **CodeQL** alerts (`github-advanced-security[bot]`).

---

## Working Style

- Files under ~500 lines. Split at natural seams.
- Prefer editing over creating.
- Smallest version first. No silent scope creep.
- Parallelise independent reads and Bash calls in the same message.
- Inline `style={{ ... }}` only when **dynamic**; static styles go in `globals.css` (per CodeRabbit + project convention).
- Image tags: use `next/image` (with `unoptimized` for canonical S3 URLs). No raw `<img>` + `// eslint-disable @next/next/no-img-element`.
- Third-party GitHub Actions pin to **commit SHAs** (not floating tags). Comment the tag name next to the SHA for readability.
- Never commit secrets. `.env` is gitignored. Run `aws sts get-caller-identity` before any AWS action so you know which account you're touching.

---

## Verification Before Completion

Before claiming work is done:
- Frontend: `npx tsc --noEmit` clean, `npm run lint` clean, `npx next build` clean.
- Backend: `make test` green (Docker up first). For pure docs / config: state explicitly that no tests were run and why.
- AWS infra: `aws cloudformation validate-template --template-body file://...` clean.

Never assert "build passes" without running it. Quote exact errors when they appear.

---

## Commands

```bash
# from /backend
make up && make migrate   # first-time setup (Docker)
make dev                  # API on :8000
make test / make test-cov
make lint / make format
make seed

# from /frontend
npm run dev               # :3000
npx tsc --noEmit          # typecheck
npm run lint              # eslint
npx next build            # full build (verifies prod bundling)

# from repo root
./infra/aws/cloudformation/deploy.sh   # one-shot prod CFN deploy
gh pr create ...
```

---

## Production Config (Railway env vars)

Set on the backend service:

| Variable | Value |
| --- | --- |
| `S3_ACCESS_KEY` | from IAM user `healall-app-prod` access key |
| `S3_SECRET_KEY` | from same access key |
| `S3_REGION` | `ap-south-1` |
| `S3_ENDPOINT_URL` | `https://s3.ap-south-1.amazonaws.com` |
| `S3_BUCKET_MEDIA` | `healall-media-prod` |
| `S3_BUCKET_IDENTITY` | `healall-identity-ephemeral-prod` |
| `RESEND_API_KEY` | resend.com domain-verified API key (Railway blocks SMTP ports) |
| `SENTRY_DSN` | from sentry.io Python/FastAPI project |
| `MSG91_API_KEY` + `MSG91_TEMPLATE_ID_OTP` | msg91 dashboard |
| `AI_TRIAGE_ENABLED` | `true` to turn on AI report triage (default `false`; also needs a key below) |
| `GROQ_API_KEY` | console.groq.com API key (primary triage provider) |
| `GROQ_MODEL` | optional, default `openai/gpt-oss-20b` |
| `GEMINI_API_KEY` | optional, aistudio.google.com key (fallback provider via OpenAI-compatible endpoint) |
| `GEMINI_MODEL` | optional, default `gemini-3.5-flash-lite` |

GitHub repo Variables (Settings → Secrets and variables → Actions → Variables):

| Name | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | from `DeployRoleArn` CFN output |

Outstanding setup tasks (run by user, not CI): see `HANDOFF.md` in repo root (gitignored) for the up-to-date list.

---

## Infrastructure Quirks

- **Railway blocks SMTP ports 25/465/587** — use Resend (HTTPS to api.resend.com:443).
- **bcrypt pinned `<4.1`** — passlib 1.7.4 incompatible with bcrypt ≥4.1 (`__about__` attribute removed). `pyproject.toml`: `bcrypt>=4.0.1,<4.1`.
- **Next.js 16 removed `next lint`.** Use `eslint .` with `eslint.config.mjs`.
- **Celery worker not deployed on Railway** — code ready in `worker/celery_app.py`; user must add a Railway service with command `celery -A app.worker.celery_app worker --loglevel=info`.
- **AWS CFN stack** lives in `infra/aws/cloudformation/healall-media.yml`. `.github/workflows/aws-infra.yml` redeploys it on every push to `main` touching that path. Concurrency-gated so parallel runs queue.

---

## Dev Tools

Loop: brainstorm (if new feature) → graphify query (if architecture-level) → plan → TDD where feasible → code → commit → review.

Skills available — **use judgment, not autopilot**:
- `superpowers:brainstorming` — only for non-trivial new work.
- `superpowers:writing-plans` — only when the task spans multiple files / sessions.
- `superpowers:requesting-code-review` — useful before opening a PR.
- `episodic-memory:search-conversations` — when stuck on "how did we approach X before".
- `graphify` — `graphify-out/GRAPH_REPORT.md` for cross-cutting architecture questions.

Don't invoke a skill for one-line edits or routine CodeRabbit fixes.

---

## Quick Navigation

| Question | Where |
| --- | --- |
| API shape | `backend/app/api/v1/X.py` → `schemas/X.py` |
| State transitions | `services/*_service.py` |
| Auth-gating | `deps.py` + route `Depends(...)` |
| Past bugs fixed | `docs/CODE_REVIEW.md` |
| Roadmap | `docs/ROADMAP.md` |
| AWS infra | `infra/aws/cloudformation/` |
| Frontend API client | `frontend/lib/api/*.ts` |
| Test fixtures | `backend/tests/conftest.py` |
| Recent state for a new session | `HANDOFF.md` (gitignored, local) |
