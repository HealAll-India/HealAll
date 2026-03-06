# HealAll — Backend Architecture README

> **Version:** 1.0 · **Date:** 16 Feb 2026
> **Stack:** Python 3.12 + FastAPI · PostgreSQL 15 · Redis 7 · Celery · S3-compatible storage
> **Status:** Phase 1 MVP specification (India-first, web-only, invite-only)

---

## 1. Executive Summary

HealAll is a volunteer-driven mutual-aid platform that connects people who need help with verified volunteers willing to offer time, skills, and presence. The backend serves a **feed-based web application** (think Instagram-style discovery, but backed by a structured case-management lifecycle) with strict identity verification, moderation, and data-minimization requirements.

**Primary constraints driving every architecture decision:**

- **Trust-first:** every help request must pass human verification before it appears in the feed. Aadhaar-based identity verification with minimal data retention.
- **Safety:** moderation queue, crisis protocol hooks, report/flag system, and consent-gated DMs.
- **No money flows:** the platform never holds, processes, or facilitates financial transactions.
- **India-first:** SMS OTP via Indian providers, Aadhaar verification, IST timezone defaults, English + future Hindi support.
- **Invite-only growth:** controlled onboarding via invite codes/waitlist to protect community quality.
- **Low operational cost:** prefer open-source, self-hostable components. Avoid vendor lock-in where possible.

---

## 2. System Overview Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB["Web App (Next.js)"]
    end

    subgraph "Edge / Reverse Proxy"
        NGINX["Nginx / Caddy"]
    end

    subgraph "Application Layer"
        API["FastAPI Server<br/>(uvicorn, async)"]
        CELERY["Celery Workers<br/>(background jobs)"]
    end

    subgraph "Data Layer"
        PG["PostgreSQL 15"]
        REDIS["Redis 7<br/>(cache + broker)"]
        S3["MinIO / S3<br/>(media + ephemeral docs)"]
    end

    subgraph "External Services"
        SMS["SMS Gateway<br/>(MSG91 / Twilio)"]
        EMAIL["Email<br/>(SMTP / SES)"]
        AADHAAR["Aadhaar Verification<br/>(Digilocker / third-party)"]
    end

    WEB -->|HTTPS| NGINX
    NGINX -->|proxy_pass| API
    API -->|read/write| PG
    API -->|cache / pub-sub| REDIS
    API -->|presigned URLs| S3
    API -->|dispatch tasks| REDIS
    REDIS -->|consume tasks| CELERY
    CELERY -->|read/write| PG
    CELERY -->|send| SMS
    CELERY -->|send| EMAIL
    CELERY -->|upload/purge| S3
    API -->|verify| AADHAAR
```

**Rationale:** A monolithic FastAPI app with Celery workers is the simplest architecture that meets MVP requirements. There is no need for microservices at this scale (hundreds to low-thousands of users in invite-only beta). If a module becomes a bottleneck later, FastAPI's router-based design makes it straightforward to extract into a separate service.

**Alternative considered:** Django + DRF. Rejected because FastAPI's native async support, automatic OpenAPI docs, and Pydantic validation are a better fit for a new project with a small team. Django's ORM and admin panel are appealing, but we can get comparable admin functionality via a lightweight admin dashboard (or FastAPI-Admin) and SQLAlchemy gives us more control.

---

## 3. Deployment Model & Infrastructure

### Phase 1 (MVP) — Single VPS

| Component         | Recommendation                     | Notes                                        |
| ----------------- | ---------------------------------- | -------------------------------------------- |
| Hosting           | Single VPS (4 vCPU, 8 GB RAM)     | DigitalOcean / Hetzner / AWS Lightsail       |
| Reverse proxy     | Caddy (auto TLS) or Nginx          | Caddy is simpler; Nginx if you need fine control |
| App server        | Uvicorn behind Gunicorn (2–4 workers) | `gunicorn -k uvicorn.workers.UvicornWorker` |
| Database          | PostgreSQL 15 (Docker or managed)  | Start with Docker; move to managed for production |
| Cache / broker    | Redis 7 (Docker)                   | Single instance is fine for MVP              |
| Object storage    | MinIO (self-hosted) or Backblaze B2 | S3-compatible; cheap at small scale          |
| Celery workers    | 1–2 workers, 4 concurrency each    | Same VPS; separate container                 |
| Monitoring        | Prometheus + Grafana (Docker)      | Lightweight stack                            |
| Error tracking    | Sentry (free tier, self-hosted or cloud) | Structured error capture                |
| TLS               | Let's Encrypt via Caddy            | Auto-renewing                                |
| CI/CD             | GitHub Actions                     | Free for public repos, generous free tier for private |

### Phase 2+ (Scaling)

- Move Postgres to a managed instance (RDS / Supabase / Neon).
- Add a CDN (Cloudflare free tier) in front of static assets and media.
- Horizontal scaling: add more Uvicorn workers / Celery workers behind a load balancer.
- Consider managed Redis (Upstash free tier / ElastiCache) if persistence matters.

---

## 4. Folder Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app factory, middleware, lifespan
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                 # Shared dependencies (get_db, get_current_user)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py           # Aggregates all v1 routers
│   │       ├── auth.py             # Signup, login, OTP, token refresh
│   │       ├── users.py            # Profile CRUD, skills, availability
│   │       ├── invites.py          # Invite code generation and redemption
│   │       ├── posts.py            # Help request CRUD, status transitions
│   │       ├── cases.py            # Case dashboard, notes, closure
│   │       ├── comments.py         # Public comments on posts
│   │       ├── messages.py         # Consent-based DMs
│   │       ├── moderation.py       # Reports, flags, enforcement actions
│   │       ├── verification.py     # Verification queue, verifier actions
│   │       ├── notifications.py    # Notification preferences + read/unread
│   │       ├── announcements.py    # Admin announcements
│   │       ├── badges.py           # Badge definitions + user badges
│   │       └── admin.py            # Admin-only operations
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py               # Pydantic Settings (reads .env)
│   │   ├── security.py             # JWT encode/decode, password hashing, RBAC
│   │   ├── exceptions.py           # Custom exception classes + handlers
│   │   └── constants.py            # Enums, magic strings, role definitions
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py                 # SQLAlchemy declarative base, mixins (timestamps, soft-delete)
│   │   ├── user.py                 # User, UserRole, UserSkill
│   │   ├── identity.py             # IdentityVerification (Aadhaar handling)
│   │   ├── invite.py               # InviteCode
│   │   ├── post.py                 # Post (help request)
│   │   ├── case.py                 # Case, CaseNote, CaseHelper
│   │   ├── comment.py              # Comment
│   │   ├── message.py              # DirectMessage, DMConsent
│   │   ├── report.py               # Report, ModerationAction
│   │   ├── notification.py         # Notification
│   │   ├── announcement.py         # Announcement
│   │   ├── badge.py                # BadgeDefinition, UserBadge
│   │   └── audit.py                # AuditLog
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py                 # Request/response schemas for auth
│   │   ├── user.py                 # UserCreate, UserRead, UserUpdate
│   │   ├── post.py                 # PostCreate, PostRead, PostUpdate
│   │   ├── case.py                 # CaseRead, CaseNoteCreate, etc.
│   │   ├── comment.py
│   │   ├── message.py
│   │   ├── moderation.py
│   │   ├── verification.py
│   │   ├── notification.py
│   │   ├── announcement.py
│   │   ├── badge.py
│   │   └── common.py               # Pagination, error response, health check
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py         # Business logic for auth flows
│   │   ├── user_service.py         # Profile operations
│   │   ├── post_service.py         # Post lifecycle + feed queries
│   │   ├── case_service.py         # Case coordination logic
│   │   ├── verification_service.py # Aadhaar flow, case verification
│   │   ├── moderation_service.py   # Report handling, enforcement
│   │   ├── notification_service.py # Notification dispatch
│   │   ├── message_service.py      # DM consent + messaging logic
│   │   ├── badge_service.py        # Badge awarding logic
│   │   └── storage_service.py      # S3 presigned URL generation, file cleanup
│   ├── workers/
│   │   ├── __init__.py
│   │   ├── celery_app.py           # Celery app factory
│   │   ├── tasks/
│   │   │   ├── __init__.py
│   │   │   ├── email_tasks.py      # Send transactional emails
│   │   │   ├── sms_tasks.py        # Send OTP / notifications via SMS
│   │   │   ├── verification_tasks.py # Aadhaar doc purge, re-verification reminders
│   │   │   ├── moderation_tasks.py # Auto-flag stale reports, digest emails
│   │   │   ├── notification_tasks.py # Push/digest notification batching
│   │   │   └── cleanup_tasks.py    # Expired invite cleanup, audit log rotation
│   │   └── schedule.py             # Celery Beat schedule definitions
│   └── db/
│       ├── __init__.py
│       ├── session.py              # Async SQLAlchemy session factory
│       └── seed.py                 # Seed script (admin user, demo data, badge defs)
├── alembic/
│   ├── alembic.ini
│   ├── env.py
│   └── versions/                   # Migration files
├── tests/
│   ├── conftest.py                 # Fixtures: test DB, test client, auth helpers
│   ├── unit/
│   │   ├── test_security.py
│   │   ├── test_auth_service.py
│   │   └── ...
│   ├── integration/
│   │   ├── test_auth_api.py
│   │   ├── test_post_lifecycle.py
│   │   └── ...
│   └── factories/
│       ├── user_factory.py         # Factory Boy factories for test data
│       └── post_factory.py
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── pyproject.toml                  # Project metadata + dependencies (uv/poetry)
├── .env.example
├── .pre-commit-config.yaml
└── Makefile                        # Common dev commands
```

**File responsibility summary:**

| Layer       | Responsibility |
| ----------- | -------------- |
| `api/`      | HTTP handlers only — validate input (via Pydantic schemas), call services, return responses. No business logic here. |
| `schemas/`  | Pydantic models for request bodies, response bodies, and query params. Separate from DB models. |
| `services/` | Business logic. Services receive validated data, coordinate DB queries, call external APIs, dispatch background tasks. |
| `models/`   | SQLAlchemy ORM models. One file per domain aggregate. |
| `workers/`  | Celery tasks. Each task is a thin wrapper that calls a service function. |
| `core/`     | Cross-cutting concerns: config, security, exceptions, constants. |
| `db/`       | Database session management and seeding. |

---

## 5. Backend Modules — Detailed Breakdown

---

### Module 1: Auth & Identity

**Purpose:** User signup (invite-only), login, OTP verification, JWT management, role assignment, and Aadhaar-based identity verification.

#### Submodule 1.1: Invite Code Management

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/invites` (admin: generate codes), `GET /v1/invites` (admin: list), `DELETE /v1/invites/{code}` (admin: revoke) |
| **DB tables** | `invite_codes` |
| **Background tasks** | `cleanup_expired_invites` (daily) |
| **Acceptance criteria** | Admin can generate single-use or multi-use invite codes with expiry. A code can be redeemed exactly once (or N times for multi-use). Expired/revoked codes return 410 Gone. |

#### Submodule 1.2: Signup + Phone/Email OTP Verification

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/auth/signup` (body: `name, phone, email, city, age_range, invite_code`), `POST /v1/auth/verify-otp` (body: `phone_or_email, otp_code`), `POST /v1/auth/resend-otp` |
| **DB tables** | `users`, `otp_attempts` |
| **Background tasks** | `send_otp_sms`, `send_otp_email` |
| **Acceptance criteria** | Signup requires a valid invite code. OTP is sent to both phone and email. User reaches verification Level 1 after both are confirmed. OTP expires after 10 minutes. Rate-limit: max 5 OTP requests per phone per hour. |

**Example request/response:**

```jsonc
// POST /v1/auth/signup
// Request
{
  "name": "Priya Sharma",
  "phone": "+919876543210",
  "email": "priya@example.com",
  "city": "Mumbai",
  "age_range": "18-24",
  "invite_code": "HEAL-ABC123",
  "roles": ["helper", "help_seeker"]
}

// Response 201
{
  "id": "usr_abc123",
  "name": "Priya Sharma",
  "verification_level": 0,
  "pending_verification": ["phone", "email"],
  "message": "OTP sent to phone and email. Please verify to continue."
}
```

#### Submodule 1.3: Aadhaar / Identity Verification (Ephemeral)

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/auth/identity/upload` (multipart: ID document image), `GET /v1/auth/identity/status` |
| **DB tables** | `identity_verifications` |
| **Background tasks** | `call_aadhaar_verification_api`, `purge_identity_document` (scheduled: 7 days after verification) |
| **Acceptance criteria** | Document is uploaded to ephemeral S3 bucket with a 7-day lifecycle policy. Third-party verification API is called. Only a SHA-256 hash of the Aadhaar number + verification status + timestamp are stored in DB. The actual document and Aadhaar number are never stored in the database. Audit log entry is created. User transitions to Level 2 on success. |

**Aadhaar handling — detailed flow:**

```
1. User uploads Aadhaar image via presigned S3 URL (client → S3 directly)
2. API records upload metadata: s3_key, uploaded_at, user_id
3. Celery task calls Aadhaar verification provider (e.g., Digilocker API / Surepass / IDfy)
4. Provider returns: verified=true/false, name_match_score, aadhaar_last_4
5. API stores in identity_verifications:
   - user_id, verified (bool), aadhaar_hash (SHA-256 of full number),
     last_four_digits, name_match_score, verified_at, verified_by_provider
6. Celery scheduled task purges the S3 object after 7 days (or immediately on success)
7. Consent: user must check "I consent to identity verification" before upload
```

**Compliance notes:**
- **UIDAI guidelines:** We do not store the full Aadhaar number. Only a one-way hash and last 4 digits.
- **IT Act 2000 + DPDP Act 2023:** Collect minimum data, explicit consent, purpose limitation, retention limits.
- **Encryption at rest:** S3 bucket uses server-side encryption (SSE-S3 or SSE-KMS). Postgres column-level encryption for `aadhaar_hash` via `pgcrypto`.
- **Access control:** Only the assigned Case Verifier and Head Admin can view identity verification status. API enforces this via RBAC middleware.
- **Right to erasure:** Users can request deletion. System purges `identity_verifications` row (except audit log entry noting deletion occurred).

#### Submodule 1.4: JWT + Refresh Tokens

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/auth/token` (login: phone/email + password or OTP), `POST /v1/auth/token/refresh`, `POST /v1/auth/token/revoke` |
| **DB tables** | `refresh_tokens` |
| **Background tasks** | `cleanup_expired_refresh_tokens` (daily) |
| **Acceptance criteria** | Access token: 15-min expiry, RS256 signed. Refresh token: 30-day expiry, stored hashed in DB, single-use (rotation on refresh). Role claims embedded in access token. Revocation invalidates the refresh token family. |

**Token structure:**

```jsonc
// Access token payload
{
  "sub": "usr_abc123",
  "roles": ["helper", "help_seeker"],
  "verification_level": 2,
  "iat": 1708000000,
  "exp": 1708000900   // 15 min
}
```

**Example DB changes:**
- `users` table → add `verification_level` enum column (0–3)
- `identity_verifications` table with minimal metadata
- `refresh_tokens` table with `token_hash`, `user_id`, `family_id`, `expires_at`, `revoked_at`

---

### Module 2: User Profile & Settings

**Purpose:** Profile CRUD, skills/availability management, privacy controls, and public profile rendering.

#### Submodule 2.1: Profile CRUD

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `GET /v1/users/me`, `PATCH /v1/users/me`, `GET /v1/users/{user_id}` (public profile), `GET /v1/users` (admin: list/search) |
| **DB tables** | `users`, `user_skills` |
| **Acceptance criteria** | Users can update name, city, age_range, bio, avatar, skills, availability, and privacy settings. Public profile hides phone/email by default. Admin can search users by name, city, verification level, role. |

#### Submodule 2.2: Privacy Controls

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `PATCH /v1/users/me/privacy` (body: `show_email`, `show_phone`, `show_city`) |
| **DB tables** | `user_privacy_settings` (or columns on `users`) |
| **Acceptance criteria** | Contact info is hidden by default. User can selectively expose fields. The public profile API respects these settings. |

#### Submodule 2.3: Blocking

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/users/{user_id}/block`, `DELETE /v1/users/{user_id}/block`, `GET /v1/users/me/blocked` |
| **DB tables** | `user_blocks` |
| **Acceptance criteria** | Blocked users cannot DM, comment on your posts, or see your posts in the feed. Blocking is bidirectional for DMs (neither party can message). |

---

### Module 3: Posts (Help Requests) & Feed

**Purpose:** Create, update, and manage help request posts. Power the discovery feed with filtering and search.

#### Submodule 3.1: Post CRUD & Status Machine

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/posts` (create draft/submit), `GET /v1/posts/{post_id}`, `PATCH /v1/posts/{post_id}`, `DELETE /v1/posts/{post_id}` (soft delete), `POST /v1/posts/{post_id}/submit` (move from draft → submitted) |
| **DB tables** | `posts`, `post_media` |
| **Background tasks** | None (synchronous for MVP) |
| **Acceptance criteria** | Post status transitions follow: `draft → submitted → needs_info / verified / rejected`. Only the post author can edit (while in draft/needs_info). Verified posts become `active`. System rejects illegal transitions. |

**Post status state machine:**

```
draft ──→ submitted ──→ needs_info ──→ submitted (re-submit)
                    ├──→ verified ──→ active ──→ resolved
                    └──→ rejected
```

#### Submodule 3.2: Feed & Discovery

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `GET /v1/feed` (query: `city`, `category`, `urgency`, `page`, `per_page`, `search`) |
| **DB tables** | `posts` (uses GIN index for full-text search) |
| **Acceptance criteria** | Feed returns only `active` (verified) posts. Filterable by city, category, urgency. Full-text search on title + description using Postgres `tsvector`. Paginated (cursor-based preferred, offset OK for MVP). Posts from blocked users are excluded. Default sort: urgency (desc) then created_at (desc). |

**Search approach (MVP):**

```sql
-- Add tsvector column and GIN index
ALTER TABLE posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);

-- Query
SELECT * FROM posts
WHERE status = 'active'
  AND search_vector @@ plainto_tsquery('english', :query)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query)) DESC;
```

**Why Postgres full-text over Elasticsearch:** For an invite-only MVP with hundreds of posts, Postgres GIN indexes are more than sufficient, avoid operational overhead of another service, and keep the stack simple. Revisit if post count exceeds ~100K or we need fuzzy/multilingual search.

#### Submodule 3.3: Post Media Upload

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/posts/{post_id}/media` (returns presigned upload URL), `DELETE /v1/posts/{post_id}/media/{media_id}` |
| **DB tables** | `post_media` |
| **Background tasks** | `scan_uploaded_media` (optional: virus scan / content moderation) |
| **Acceptance criteria** | Max 5 media files per post. Allowed types: JPEG, PNG, PDF. Max size: 10 MB per file. Files uploaded via presigned URL to S3. Media is soft-deleted when post is deleted. |

---

### Module 4: Case Lifecycle & Verification Queue

**Purpose:** Once a post is verified, it becomes a Case. Manage case ownership, helper assignments, notes, progress, and closure.

#### Submodule 4.1: Verification Queue (Verifier Actions)

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `GET /v1/verification/queue` (verifier: list pending posts), `POST /v1/verification/{post_id}/verify` (approve), `POST /v1/verification/{post_id}/request-info` (needs info), `POST /v1/verification/{post_id}/reject` (reject with reason) |
| **DB tables** | `verifications` (links post to verifier + decision + remarks) |
| **Background tasks** | `notify_seeker_verification_result`, `stale_verification_reminder` (if post sits in queue > 24h) |
| **Acceptance criteria** | Only users with `case_verifier` role can access. Verifier must add remarks when verifying or rejecting. On verification, a Case record is automatically created and post status moves to `active`. |

#### Submodule 4.2: Case Management

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `GET /v1/cases` (user: my cases), `GET /v1/cases/{case_id}`, `PATCH /v1/cases/{case_id}` (update case owner), `POST /v1/cases/{case_id}/helpers` (offer help), `DELETE /v1/cases/{case_id}/helpers/{user_id}` (withdraw) |
| **DB tables** | `cases`, `case_helpers` |
| **Acceptance criteria** | A case is created automatically when a post is verified. Anyone can offer help (creates a `case_helpers` entry). When ≥2 helpers join, system suggests assigning a Case Owner. Case owner can be set by verifier or admin. |

#### Submodule 4.3: Case Notes & Progress

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/cases/{case_id}/notes`, `GET /v1/cases/{case_id}/notes` |
| **DB tables** | `case_notes` |
| **Acceptance criteria** | Notes are visible only to case team (helpers on the case + case owner + verifier + admins). Notes support text + optional attachment (presigned S3). Helper can log what they did (type of support, hours contributed). |

#### Submodule 4.4: Case Closure

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/cases/{case_id}/close` (body: `closure_remarks`, `resolution_type`), `POST /v1/cases/{case_id}/reopen` (verifier/admin only) |
| **DB tables** | `cases` (status update), `case_closures` |
| **Background tasks** | `award_badges_on_closure`, `notify_case_team_closure`, `request_impact_story_consent` |
| **Acceptance criteria** | Closure can be requested by case owner or help-seeker. Verifier must confirm closure. Closure remarks are logged. Badges are awarded based on verified contributions. Optionally, an anonymized impact story can be generated (with consent). |

---

### Module 5: Comments & Messaging

**Purpose:** Public comments on posts (for clarification) and consent-based direct messaging.

#### Submodule 5.1: Comments

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/posts/{post_id}/comments`, `GET /v1/posts/{post_id}/comments`, `DELETE /v1/comments/{comment_id}` (author or admin) |
| **DB tables** | `comments` |
| **Acceptance criteria** | Comments are public, visible to anyone who can see the post. Supports text only (no media in MVP). Author or admin can delete. Blocked users' comments are hidden from the blocker. |

#### Submodule 5.2: Consent-Based Direct Messages

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/messages/request-consent` (to: user_id, context: post_id), `POST /v1/messages/consent/{request_id}/accept`, `POST /v1/messages/consent/{request_id}/decline`, `POST /v1/messages/conversations/{conversation_id}`, `GET /v1/messages/conversations`, `GET /v1/messages/conversations/{conversation_id}` |
| **DB tables** | `dm_consent_requests`, `conversations`, `messages` |
| **Acceptance criteria** | DM requires explicit consent from both parties. Consent request includes context (which post). Declined requests cannot be re-sent for 7 days. Messages are text-only in MVP. Either party can end the conversation. Blocked users cannot send consent requests. |

---

### Module 6: Moderation & Reporting

**Purpose:** Report/flag system, moderation queue, enforcement actions, and audit trail.

#### Submodule 6.1: Reports

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/reports` (body: `target_type`, `target_id`, `reason`, `description`), `GET /v1/reports` (admin: list pending) |
| **DB tables** | `reports` |
| **Acceptance criteria** | Users can report posts, comments, messages, or users. Target types: `post`, `comment`, `message`, `user`. Duplicate reports on the same target by the same user are rejected. Reports enter a moderation queue. |

#### Submodule 6.2: Moderation Actions

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/moderation/actions` (body: `report_id`, `action`, `reason`, `duration`), `GET /v1/moderation/actions` (admin: action history) |
| **DB tables** | `moderation_actions` |
| **Background tasks** | `auto_unsuspend_on_expiry`, `notify_user_of_action` |
| **Acceptance criteria** | Actions: `warn`, `restrict` (limited posting), `suspend` (time-bound), `ban` (permanent). Only admin/moderator can take actions. User is notified of action + reason. Suspension has an expiry; system auto-lifts it. All actions are logged in audit trail. |

#### Submodule 6.3: Crisis Content Detection

| Item | Detail |
| ---- | ------ |
| **Endpoints** | Internal service hook (not a public endpoint) |
| **Background tasks** | `flag_crisis_content` (keyword-based for MVP) |
| **Acceptance criteria** | Posts/comments containing crisis keywords (self-harm, suicide, domestic violence) are auto-flagged for immediate admin review. Auto-response includes crisis helpline numbers (iCall: 9152987821, Vandrevala Foundation: 1860-2662-345, Emergency: 112). Admins can temporarily hide content pending review. |

---

### Module 7: Notifications

**Purpose:** In-app notifications and optional email/SMS digests.

#### Submodule 7.1: In-App Notifications

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `GET /v1/notifications` (paginated), `PATCH /v1/notifications/{id}/read`, `PATCH /v1/notifications/read-all`, `GET /v1/notifications/unread-count` |
| **DB tables** | `notifications` |
| **Acceptance criteria** | Notifications for: new comment on your post, help offered on your case, verification decision, DM consent request, case closure, moderation action, new announcement. Paginated, ordered by created_at desc. Unread count endpoint for badge display. |

#### Submodule 7.2: Email & SMS Digests

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `PATCH /v1/users/me/notification-preferences` (toggle channels) |
| **DB tables** | `notification_preferences` |
| **Background tasks** | `send_daily_digest_email`, `send_critical_sms` (for moderation actions, crisis flags) |
| **Acceptance criteria** | Users can opt into daily digest email. Critical notifications (account actions, crisis flags) are always sent via SMS. Transactional emails (OTP, verification result) are always sent. |

---

### Module 8: Announcements

**Purpose:** Admin-posted announcements, pinnable, optionally included in digest.

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `POST /v1/announcements` (admin), `GET /v1/announcements`, `PATCH /v1/announcements/{id}`, `DELETE /v1/announcements/{id}` |
| **DB tables** | `announcements` |
| **Background tasks** | `send_announcement_digest` (if `include_in_digest=true`) |
| **Acceptance criteria** | Only admin can create/edit/delete. Announcements can be pinned (appear at top of feed). Can be marked for digest inclusion. Support title + body (markdown). |

---

### Module 9: Badges & Recognition

**Purpose:** Define badge types and award them based on verified contributions.

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `GET /v1/badges` (list all badge types), `GET /v1/users/{user_id}/badges`, `POST /v1/badges` (admin: create badge definition), `POST /v1/users/{user_id}/badges` (admin/system: award badge) |
| **DB tables** | `badge_definitions`, `user_badges` |
| **Background tasks** | `evaluate_badge_eligibility` (triggered on case closure) |
| **Acceptance criteria** | Badge types: "First Help", "5 Cases Supported", "10 Cases Supported", "Trusted Verifier", etc. Badges are awarded automatically on case closure based on contribution count. Admin can also award special badges manually. Badges are visible on public profile. |

---

### Module 10: Admin Tools

**Purpose:** Admin dashboard API: user management, system stats, configuration.

| Item | Detail |
| ---- | ------ |
| **Endpoints** | `GET /v1/admin/stats` (dashboard stats), `GET /v1/admin/users` (search/filter), `PATCH /v1/admin/users/{id}/role` (assign roles), `GET /v1/admin/audit-log` (paginated audit trail) |
| **DB tables** | `audit_logs` (reads), `users` (role updates) |
| **Acceptance criteria** | Stats include: total users, active cases, pending verifications, pending reports, posts by category. Role assignment restricted to head_admin. Audit log captures all sensitive operations (role changes, bans, identity verifications, case closures). |

---

## 6. API Surface — Auth Rules & Error Codes

### Authentication & Authorization

| Token Type | Location | Lifetime |
| ---------- | -------- | -------- |
| Access token (JWT) | `Authorization: Bearer <token>` header | 15 minutes |
| Refresh token | `HttpOnly` cookie (`healall_refresh`) | 30 days |
| CSRF token | `X-CSRF-Token` header (when using cookie auth) | Tied to session |

### Role-Based Access Control (RBAC)

| Role | Permissions |
| ---- | ----------- |
| `help_seeker` | Create posts, view feed, comment, send DM consent requests, manage own profile |
| `helper` | All of help_seeker + offer help on cases, add case notes |
| `case_verifier` | All of helper + access verification queue, verify/reject posts, view identity status |
| `case_owner` | All of helper + manage assigned case (set owner, close), write case notes |
| `moderator` | All of helper + access moderation queue, take enforcement actions (warn/restrict/suspend) |
| `admin` | All of moderator + manage announcements, view audit logs, assign roles (except head_admin), manage invite codes |
| `head_admin` | All of admin + assign admin/verifier roles, ban users, final policy authority |

Roles are **additive** — a user can hold multiple roles (e.g., `helper` + `case_verifier`).

### Standard Error Response Format

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      {"field": "phone", "message": "Invalid Indian phone number format"}
    ]
  }
}
```

### Error Codes

| HTTP Status | Code | When |
| ----------- | ---- | ---- |
| 400 | `VALIDATION_ERROR` | Request body fails Pydantic validation |
| 400 | `INVALID_STATE_TRANSITION` | Post/case status change not allowed |
| 401 | `UNAUTHENTICATED` | Missing or expired access token |
| 401 | `INVALID_CREDENTIALS` | Wrong phone/email + OTP combination |
| 403 | `FORBIDDEN` | Authenticated but lacks required role |
| 403 | `BLOCKED_USER` | Trying to interact with a user who blocked you |
| 404 | `NOT_FOUND` | Resource doesn't exist or soft-deleted |
| 409 | `DUPLICATE` | Duplicate report, already offered help, etc. |
| 410 | `EXPIRED` | Invite code or OTP expired |
| 429 | `RATE_LIMITED` | Too many requests (OTP, DM consent) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## 7. Database Schema Design

### Entity-Relationship Summary

```
users ──< user_skills
users ──< user_blocks (blocker / blocked)
users ──< identity_verifications
users ──< refresh_tokens
users ──< notifications
users ──< user_badges

invite_codes (standalone, redeemed_by → users)

posts ──< post_media
posts ──< comments
posts ──< verifications
posts ── cases (1:1)

cases ──< case_helpers (user_id → users)
cases ──< case_notes
cases ──< case_closures

dm_consent_requests (from_user, to_user, post_id)
conversations ──< messages

reports (reporter → users, target polymorphic)
moderation_actions (report_id → reports, acted_by → users)

announcements (created_by → users)
badge_definitions ──< user_badges

audit_logs (actor → users)
```

### Core Tables

#### `users`

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,
    phone           VARCHAR(15) UNIQUE NOT NULL,       -- E.164 format
    email           VARCHAR(255) UNIQUE NOT NULL,
    city            VARCHAR(100) NOT NULL,
    age_range       VARCHAR(10) NOT NULL,              -- '13-17', '18-24', '25-34', '35-44', '45+'
    bio             TEXT,
    avatar_url      VARCHAR(500),
    roles           VARCHAR(30)[] NOT NULL DEFAULT '{help_seeker}',
    verification_level SMALLINT NOT NULL DEFAULT 0,    -- 0-3
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    suspended_until TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ                        -- soft delete
);

CREATE INDEX idx_users_city ON users(city) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_roles ON users USING GIN(roles) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_verification ON users(verification_level) WHERE deleted_at IS NULL;
```

#### `identity_verifications`

```sql
CREATE TABLE identity_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    aadhaar_hash    BYTEA NOT NULL,                    -- SHA-256 hash, encrypted at rest
    last_four       CHAR(4) NOT NULL,
    name_match      REAL,                              -- 0.0 - 1.0 confidence score
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, verified, failed, expired
    provider        VARCHAR(50),                       -- 'digilocker', 'surepass', etc.
    s3_key          VARCHAR(500),                      -- ephemeral; set to NULL after purge
    consent_given   BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,
    purged_at       TIMESTAMPTZ,                       -- when document was deleted from S3
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_identity_user ON identity_verifications(user_id);
```

#### `invite_codes`

```sql
CREATE TABLE invite_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) UNIQUE NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    max_uses        INT NOT NULL DEFAULT 1,
    use_count       INT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_code ON invite_codes(code) WHERE NOT revoked;
```

#### `posts`

```sql
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(50) NOT NULL,              -- emotional_support, mentorship, skill_sharing, navigation, on_ground, urgent
    urgency         VARCHAR(10) NOT NULL DEFAULT 'normal', -- low, normal, high, critical
    city            VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, submitted, needs_info, verified, rejected, active, resolved
    contact_prefs   JSONB,                             -- {"whatsapp": true, "email": false, "phone": false}
    search_vector   TSVECTOR GENERATED ALWAYS AS (
                      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                      setweight(to_tsvector('english', coalesce(description, '')), 'B')
                    ) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_posts_feed ON posts(urgency DESC, created_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_posts_author ON posts(author_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_status ON posts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_city ON posts(city) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_posts_category ON posts(category) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);
```

#### `post_media`

```sql
CREATE TABLE post_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id),
    s3_key          VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    content_type    VARCHAR(50) NOT NULL,
    size_bytes      INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_media_post ON post_media(post_id);
```

#### `verifications`

```sql
CREATE TABLE verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id),
    verifier_id     UUID NOT NULL REFERENCES users(id),
    decision        VARCHAR(20) NOT NULL,              -- verified, needs_info, rejected
    remarks         TEXT NOT NULL,                     -- verifier's notes (private)
    evidence_s3_key VARCHAR(500),                      -- optional evidence attachment
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verifications_post ON verifications(post_id);
```

#### `cases`

```sql
CREATE TABLE cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID UNIQUE NOT NULL REFERENCES posts(id),
    owner_id        UUID REFERENCES users(id),         -- case owner (volunteer lead), nullable initially
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active, closed, reopened
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_owner ON cases(owner_id);
```

#### `case_helpers`

```sql
CREATE TABLE case_helpers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active, withdrawn
    offered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at    TIMESTAMPTZ,
    UNIQUE(case_id, user_id)
);
```

#### `case_notes`

```sql
CREATE TABLE case_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id),
    author_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL,
    support_type    VARCHAR(50),                       -- time, skill, guidance, logistics, emotional
    hours_contributed REAL,
    attachment_s3_key VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_notes_case ON case_notes(case_id);
```

#### `case_closures`

```sql
CREATE TABLE case_closures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id),
    closed_by       UUID NOT NULL REFERENCES users(id),
    confirmed_by    UUID REFERENCES users(id),         -- verifier who confirmed
    resolution_type VARCHAR(30) NOT NULL,              -- resolved, stale, invalid, withdrawn
    remarks         TEXT NOT NULL,
    impact_story    TEXT,                               -- anonymized, optional, consent-gated
    impact_consent  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `comments`

```sql
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id),
    author_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_comments_post ON comments(post_id, created_at) WHERE deleted_at IS NULL;
```

#### `dm_consent_requests`

```sql
CREATE TABLE dm_consent_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id    UUID NOT NULL REFERENCES users(id),
    to_user_id      UUID NOT NULL REFERENCES users(id),
    post_id         UUID REFERENCES posts(id),         -- context: which post triggered this
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, declined
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_consent_to ON dm_consent_requests(to_user_id, status);
```

#### `conversations` and `messages`

```sql
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_id      UUID NOT NULL REFERENCES dm_consent_requests(id),
    user_a          UUID NOT NULL REFERENCES users(id),
    user_b          UUID NOT NULL REFERENCES users(id),
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_convo ON messages(conversation_id, created_at);
```

#### `reports` and `moderation_actions`

```sql
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES users(id),
    target_type     VARCHAR(20) NOT NULL,              -- post, comment, message, user
    target_id       UUID NOT NULL,
    reason          VARCHAR(50) NOT NULL,              -- spam, harassment, fraud, solicitation, crisis, other
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, reviewing, resolved, dismissed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(reporter_id, target_type, target_id)
);

CREATE INDEX idx_reports_status ON reports(status, created_at);

CREATE TABLE moderation_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID REFERENCES reports(id),
    target_user_id  UUID NOT NULL REFERENCES users(id),
    acted_by        UUID NOT NULL REFERENCES users(id),
    action          VARCHAR(20) NOT NULL,              -- warn, restrict, suspend, ban, dismiss
    reason          TEXT NOT NULL,
    duration_hours  INT,                               -- for suspend
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `notifications`

```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            VARCHAR(50) NOT NULL,              -- comment, help_offered, verified, dm_request, case_closed, moderation, announcement
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    reference_type  VARCHAR(20),                       -- post, case, conversation, report
    reference_id    UUID,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
```

#### `announcements`

```sql
CREATE TABLE announcements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by      UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    include_in_digest BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `badge_definitions` and `user_badges`

```sql
CREATE TABLE badge_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(50) UNIQUE NOT NULL,       -- 'first_help', '5_cases', '10_cases', 'trusted_verifier'
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    icon_url        VARCHAR(500),
    auto_award_rule JSONB,                             -- {"type": "case_count", "threshold": 5}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    badge_id        UUID NOT NULL REFERENCES badge_definitions(id),
    awarded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    awarded_by      UUID REFERENCES users(id),         -- NULL if auto-awarded
    UNIQUE(user_id, badge_id)
);
```

#### `audit_logs`

```sql
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID REFERENCES users(id),         -- NULL for system actions
    action          VARCHAR(100) NOT NULL,             -- 'user.role_changed', 'identity.verified', 'post.rejected', 'user.banned'
    target_type     VARCHAR(50),
    target_id       UUID,
    metadata        JSONB,                             -- extra context
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
```

#### `otp_attempts`

```sql
CREATE TABLE otp_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_or_email  VARCHAR(255) NOT NULL,
    otp_hash        VARCHAR(128) NOT NULL,             -- hashed OTP
    purpose         VARCHAR(20) NOT NULL DEFAULT 'signup', -- signup, login
    attempts        SMALLINT NOT NULL DEFAULT 0,       -- wrong attempts (lock after 5)
    expires_at      TIMESTAMPTZ NOT NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_lookup ON otp_attempts(phone_or_email, purpose)
  WHERE verified_at IS NULL;
```

#### `user_skills`

```sql
CREATE TABLE user_skills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    skill           VARCHAR(100) NOT NULL,
    UNIQUE(user_id, skill)
);

CREATE INDEX idx_user_skills_user ON user_skills(user_id);
```

#### `user_blocks`

```sql
CREATE TABLE user_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id      UUID NOT NULL REFERENCES users(id),
    blocked_id      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(blocker_id, blocked_id)
);
```

#### `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    token_hash      VARCHAR(128) NOT NULL UNIQUE,
    family_id       UUID NOT NULL,                     -- for rotation detection
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
```

### Migration Plan

**Tool:** Alembic (the standard for SQLAlchemy-based projects).

```bash
# Initialize (one-time)
alembic init alembic

# Create a migration
alembic revision --autogenerate -m "create_users_table"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

**Migration strategy:**
1. Each module gets its own migration file for initial table creation.
2. Migrations are ordered: `users` → `invite_codes` → `identity_verifications` → `posts` → `cases` → `comments` → `messages` → `reports` → `notifications` → `announcements` → `badges` → `audit_logs`.
3. Every migration must be reversible (include `downgrade` operations).
4. Data migrations (e.g., seeding badge definitions) are separate from schema migrations.

**Example Alembic migration:**

```python
"""create users table

Revision ID: 001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY

revision = "001_create_users"
down_revision = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(15), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("age_range", sa.String(10), nullable=False),
        sa.Column("bio", sa.Text()),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("roles", ARRAY(sa.String(30)), nullable=False, server_default="{}"),
        sa.Column("verification_level", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("suspended_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_users_city", "users", ["city"], postgresql_where=sa.text("deleted_at IS NULL"))


def downgrade():
    op.drop_table("users")
```

---

## 8. Data Privacy & Aadhaar Handling

### Minimal Retention Plan

| Data Type | Stored Where | Retention | Purge Method |
| --------- | ------------ | --------- | ------------ |
| Aadhaar document image | S3 (ephemeral bucket) | 7 days after upload (or immediately on successful verification) | S3 lifecycle policy + Celery purge task |
| Aadhaar number hash | `identity_verifications.aadhaar_hash` | Until user requests deletion | Column encrypted via `pgcrypto`, deleted on user request |
| Last 4 digits of Aadhaar | `identity_verifications.last_four` | Until user requests deletion | Deleted on user request |
| Full Aadhaar number | **Never stored** | — | — |
| Phone / email | `users` table | Account lifetime | Anonymized or deleted on account deletion |
| IP addresses | `audit_logs.ip_address` | 90 days | Celery task sets to NULL after 90 days |
| OTP codes | `otp_attempts.otp_hash` | 10 minutes (expiry) | Celery cleanup daily |
| Refresh tokens | `refresh_tokens` | 30 days | Celery cleanup daily |

### Compliance Checklist

- [ ] **DPDP Act 2023 (India):** explicit consent before collecting personal data, purpose limitation, right to erasure
- [ ] **UIDAI Regulations:** never store full Aadhaar number, use only for verification, mask in UI
- [ ] **IT Act 2000 Section 43A:** reasonable security practices for sensitive personal data
- [ ] **Encryption at rest:** Postgres via `pgcrypto` for Aadhaar hashes; S3 via SSE
- [ ] **Encryption in transit:** TLS 1.2+ everywhere (Caddy/Nginx handles this)
- [ ] **Access control:** Aadhaar data accessible only by assigned verifier + head_admin (enforced at API layer + DB row-level if needed)
- [ ] **Audit trail:** every identity verification action logged in `audit_logs`
- [ ] **User consent screen:** before Aadhaar upload, user must check consent checkbox (stored as `consent_given` boolean)
- [ ] **Right to erasure:** `DELETE /v1/users/me` endpoint that anonymizes user data and purges identity records (audit log entry preserved noting deletion)

---

## 9. Background Jobs, Queues & Scheduling

### Stack: Celery + Redis

**Why Celery over alternatives:**

| Option | Pros | Cons | Verdict |
| ------ | ---- | ---- | ------- |
| **Celery** | Battle-tested, rich ecosystem, Celery Beat for scheduling, good monitoring (Flower) | Heavier, more config | **Chosen** — reliability matters for a trust platform |
| RQ (Redis Queue) | Simpler, lightweight | No built-in scheduling, fewer features | Good for simpler apps |
| Dramatiq | Modern API, simpler than Celery | Smaller community, less tooling | Worth watching |
| ARQ | Async-native (asyncio) | Small community, limited features | Too young for production |

### Task Registry

| Task | Queue | Schedule | Retry | Description |
| ---- | ----- | -------- | ----- | ----------- |
| `send_otp_sms` | `high` | On-demand | 3x, exponential backoff | Send OTP via SMS gateway |
| `send_otp_email` | `high` | On-demand | 3x, exponential backoff | Send OTP via email |
| `send_transactional_email` | `default` | On-demand | 3x | Verification result, moderation notice |
| `call_aadhaar_verification` | `default` | On-demand | 2x | Call third-party Aadhaar API |
| `purge_identity_document` | `low` | Daily at 02:00 IST | 1x | Delete S3 objects older than 7 days |
| `cleanup_expired_otps` | `low` | Daily at 03:00 IST | 1x | Delete expired OTP rows |
| `cleanup_expired_invites` | `low` | Daily at 03:00 IST | 1x | Mark expired invite codes |
| `cleanup_expired_tokens` | `low` | Daily at 03:00 IST | 1x | Delete expired refresh tokens |
| `nullify_old_ip_addresses` | `low` | Daily at 03:00 IST | 1x | Set audit_logs.ip_address to NULL for rows > 90 days |
| `stale_verification_reminder` | `default` | Every 6 hours | 1x | Notify verifiers of posts in queue > 24h |
| `auto_unsuspend_users` | `default` | Every hour | 1x | Lift suspensions that have expired |
| `send_daily_digest` | `default` | Daily at 08:00 IST | 1x | Email digest of announcements + notifications |
| `flag_crisis_content` | `high` | On-demand (post/comment created) | 1x | Keyword scan for crisis content |
| `evaluate_badge_eligibility` | `low` | On case closure | 1x | Check if user qualifies for new badges |

### Celery Configuration

```python
# app/workers/celery_app.py
from celery import Celery
from celery.schedules import crontab

celery_app = Celery("healall")
celery_app.config_from_object({
    "broker_url": "redis://redis:6379/0",
    "result_backend": "redis://redis:6379/1",
    "task_serializer": "json",
    "accept_content": ["json"],
    "timezone": "Asia/Kolkata",
    "task_routes": {
        "app.workers.tasks.sms_tasks.*": {"queue": "high"},
        "app.workers.tasks.email_tasks.send_otp_email": {"queue": "high"},
        "app.workers.tasks.moderation_tasks.flag_crisis_content": {"queue": "high"},
        "app.workers.tasks.cleanup_tasks.*": {"queue": "low"},
    },
    "beat_schedule": {
        "purge-identity-docs": {
            "task": "app.workers.tasks.verification_tasks.purge_identity_documents",
            "schedule": crontab(hour=2, minute=0),  # 02:00 IST daily
        },
        "cleanup-expired-data": {
            "task": "app.workers.tasks.cleanup_tasks.cleanup_all_expired",
            "schedule": crontab(hour=3, minute=0),
        },
        "stale-verification-check": {
            "task": "app.workers.tasks.verification_tasks.stale_verification_reminder",
            "schedule": crontab(minute=0, hour="*/6"),  # every 6 hours
        },
        "auto-unsuspend": {
            "task": "app.workers.tasks.moderation_tasks.auto_unsuspend_users",
            "schedule": crontab(minute=0),  # every hour
        },
        "daily-digest": {
            "task": "app.workers.tasks.notification_tasks.send_daily_digest",
            "schedule": crontab(hour=8, minute=0),
        },
    },
})
```

### Monitoring Workers

Use **Flower** (open-source Celery monitoring):

```bash
celery -A app.workers.celery_app flower --port=5555
```

---

## 10. Docker & Local Development

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-healall}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: ${POSTGRES_DB:-healall_db}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U healall"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  api:
    build:
      context: .
      dockerfile: Dockerfile
    command: >
      gunicorn app.main:app
      -k uvicorn.workers.UvicornWorker
      -b 0.0.0.0:8000
      --workers 2
      --reload
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app

  celery-worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A app.workers.celery_app worker -l info -Q high,default,low -c 4
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app

  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A app.workers.celery_app beat -l info
    env_file: .env
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - .:/app

volumes:
  pgdata:
  minio_data:
```

### `.env.example`

```bash
# App
APP_ENV=development
APP_DEBUG=true
APP_SECRET_KEY=change-me-in-production
APP_ALLOWED_ORIGINS=http://localhost:3000

# Database
POSTGRES_USER=healall
POSTGRES_PASSWORD=changeme
POSTGRES_DB=healall_db
DATABASE_URL=postgresql+asyncpg://healall:changeme@postgres:5432/healall_db

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=change-me-to-a-random-256-bit-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# S3 / MinIO
S3_ENDPOINT_URL=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_MEDIA=healall-media
S3_BUCKET_IDENTITY=healall-identity-ephemeral
S3_REGION=us-east-1

# SMS (stubbed in dev)
SMS_PROVIDER=stub
SMS_API_KEY=
SMS_SENDER_ID=HEALAL

# Email
EMAIL_PROVIDER=stub
EMAIL_SMTP_HOST=
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=
EMAIL_SMTP_PASSWORD=
EMAIL_FROM=noreply@healall.in

# Aadhaar Verification
AADHAAR_PROVIDER=stub
AADHAAR_API_KEY=
AADHAAR_API_URL=

# Sentry
SENTRY_DSN=
```

### `Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && uv pip install --system -e ".[dev]"

COPY . .

EXPOSE 8000

CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

### Dev Workflow Commands (`Makefile`)

```makefile
.PHONY: up down logs migrate seed test lint format

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f api celery-worker

migrate:
	docker compose exec api alembic upgrade head

rollback:
	docker compose exec api alembic downgrade -1

seed:
	docker compose exec api python -m app.db.seed

test:
	docker compose exec api pytest tests/ -v --tb=short --cov=app --cov-report=term-missing

test-unit:
	docker compose exec api pytest tests/unit/ -v

test-integration:
	docker compose exec api pytest tests/integration/ -v

lint:
	docker compose exec api ruff check app/ tests/

format:
	docker compose exec api ruff format app/ tests/

shell:
	docker compose exec api python -c "from app.main import app; import code; code.interact(local=locals())"
```

### Seed Script

```python
# app/db/seed.py
"""
Run: python -m app.db.seed
Creates admin user, demo data, and badge definitions for development.
"""
import asyncio
from app.db.session import async_session
from app.models.user import User
from app.models.badge import BadgeDefinition

async def seed():
    async with async_session() as session:
        # Create Head Admin
        admin = User(
            name="Anupam",
            phone="+919999999999",
            email="anupam@healall.in",
            city="Delhi",
            age_range="18-24",
            roles=["head_admin", "admin", "case_verifier", "helper", "help_seeker"],
            verification_level=2,
            phone_verified=True,
            email_verified=True,
        )
        session.add(admin)

        # Seed badge definitions
        badges = [
            BadgeDefinition(slug="first_help", name="First Help", description="Offered help on your first case", auto_award_rule={"type": "case_count", "threshold": 1}),
            BadgeDefinition(slug="5_cases", name="5 Cases Supported", description="Helped on 5 verified cases", auto_award_rule={"type": "case_count", "threshold": 5}),
            BadgeDefinition(slug="10_cases", name="10 Cases Supported", description="Helped on 10 verified cases", auto_award_rule={"type": "case_count", "threshold": 10}),
            BadgeDefinition(slug="trusted_verifier", name="Trusted Verifier", description="Verified 20+ cases accurately", auto_award_rule={"type": "verification_count", "threshold": 20}),
        ]
        session.add_all(badges)

        await session.commit()
        print("Seed data created successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
```

---

## 11. Monitoring, Observability & Ops Runbook

### Structured Logging

Use `structlog` for JSON-formatted structured logs:

```python
# app/core/logging.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()

# Usage in services:
logger.info("post.verified", post_id=post_id, verifier_id=verifier_id)
```

### Error Tracking — Sentry

```python
# app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration(), CeleryIntegration()],
        traces_sample_rate=0.1,
        environment=settings.APP_ENV,
    )
```

### Metrics — Prometheus + Grafana

Use `prometheus-fastapi-instrumentator` for automatic HTTP metrics:

```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

**Key metrics to track:**
- Request rate and latency (p50, p95, p99) by endpoint
- Error rate (4xx, 5xx) by endpoint
- Active DB connections
- Celery task queue depth and latency
- Verification queue depth (pending posts)
- Moderation queue depth (pending reports)

### Alert Rules (examples)

| Alert | Condition | Action |
| ----- | --------- | ------ |
| High error rate | 5xx rate > 5% for 5 minutes | Page on-call |
| DB connection pool exhausted | Active connections > 80% of pool | Scale pool or investigate |
| Verification queue stale | Posts pending > 48 hours | Notify head admin |
| Celery worker down | Worker heartbeat missing > 5 min | Restart worker container |
| Disk usage high | > 80% on any volume | Expand volume or cleanup |

### Ops Runbook

#### Database Backup & Restore

```bash
# Backup
docker compose exec postgres pg_dump -U healall healall_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260216.sql.gz | docker compose exec -T postgres psql -U healall healall_db

# Automated daily backup (add to crontab or use a backup container)
0 1 * * * docker compose exec -T postgres pg_dump -U healall healall_db | gzip > /backups/healall_$(date +\%Y\%m\%d).sql.gz
```

#### Rotating Secrets

1. Generate new `JWT_SECRET_KEY` and `APP_SECRET_KEY`.
2. Update `.env` on the server.
3. Restart the API and Celery containers: `docker compose restart api celery-worker`.
4. Existing access tokens will be invalidated (15-min natural expiry). Refresh tokens will continue to work since they're validated against the DB.

#### Recovering from Failed Migration

```bash
# Check current migration state
docker compose exec api alembic current

# Rollback to previous version
docker compose exec api alembic downgrade -1

# Fix the migration file, then re-apply
docker compose exec api alembic upgrade head
```

---

## 12. Testing & Quality

### Testing Strategy

| Layer | Tool | What to test |
| ----- | ---- | ------------ |
| **Unit** | `pytest` | Service functions, utility functions, validators, security helpers |
| **Integration** | `pytest` + `httpx.AsyncClient` | API endpoints against a real test DB |
| **Contract** | Pydantic schema validation | Request/response schemas match expectations |
| **E2E** (future) | Playwright (driven from FE) | Full user flows through the API |

### Test Infrastructure

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.main import app
from app.db.session import get_db
from app.models.base import Base

TEST_DATABASE_URL = "postgresql+asyncpg://healall:changeme@localhost:5432/healall_test"

@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(engine):
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture
async def auth_headers(client):
    """Create a verified test user and return auth headers."""
    # ... create user, get token, return {"Authorization": f"Bearer {token}"}
```

### Example Test

```python
# tests/integration/test_auth_api.py
import pytest

@pytest.mark.asyncio
async def test_signup_with_valid_invite(client, db_session):
    # Arrange: create an invite code in the DB
    # ...

    # Act
    response = await client.post("/v1/auth/signup", json={
        "name": "Test User",
        "phone": "+919876543210",
        "email": "test@example.com",
        "city": "Mumbai",
        "age_range": "18-24",
        "invite_code": "TEST-CODE",
        "roles": ["helper"],
    })

    # Assert
    assert response.status_code == 201
    data = response.json()
    assert data["verification_level"] == 0
    assert "phone" in data["pending_verification"]

@pytest.mark.asyncio
async def test_signup_without_invite_fails(client):
    response = await client.post("/v1/auth/signup", json={
        "name": "Test User",
        "phone": "+919876543210",
        "email": "test@example.com",
        "city": "Mumbai",
        "age_range": "18-24",
        "invite_code": "INVALID",
        "roles": ["helper"],
    })
    assert response.status_code == 410
    assert response.json()["error"]["code"] == "EXPIRED"
```

### Code Quality

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

**Coverage threshold:** 80% minimum, enforced in CI.

```bash
pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=80
```

---

## 13. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv pip install --system -e ".[dev]"
      - run: ruff check app/ tests/
      - run: ruff format --check app/ tests/

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: healall
          POSTGRES_PASSWORD: changeme
          POSTGRES_DB: healall_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv pip install --system -e ".[dev]"
      - run: pytest tests/ -v --cov=app --cov-report=xml --cov-fail-under=80
        env:
          DATABASE_URL: postgresql+asyncpg://healall:changeme@localhost:5432/healall_test
          REDIS_URL: redis://localhost:6379/0

  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t healall-api:${{ github.sha }} .
      # Push to container registry (GHCR, Docker Hub, etc.)
```

### Deployment Flow

```
feature branch → PR → CI (lint + test) → merge to main → CI (build image) → deploy to staging → manual approval → deploy to production
```

For MVP, deployment can be as simple as:

```bash
# On the VPS
git pull origin main
docker compose build api
docker compose up -d api celery-worker celery-beat
docker compose exec api alembic upgrade head
```

---

## 14. Implementation Roadmap

### Phase 1 — MVP (ordered by dependency)

| Priority | Module | Complexity | Dependencies |
| -------- | ------ | ---------- | ------------ |
| P0 | Project setup (Docker, DB, config, CI) | Low | — |
| P0 | Auth & Identity (signup, OTP, JWT) | Medium | Project setup |
| P0 | User Profile | Low | Auth |
| P0 | Invite Code Management | Low | Auth |
| P1 | Posts (CRUD, status machine) | Medium | User Profile |
| P1 | Feed & Discovery (search, filter) | Medium | Posts |
| P1 | Verification Queue | Medium | Posts |
| P1 | Case Lifecycle (create, helpers, notes) | High | Verification Queue |
| P1 | Case Closure & Badges | Medium | Case Lifecycle |
| P2 | Comments | Low | Posts |
| P2 | Consent-Based DMs | Medium | User Profile |
| P2 | Moderation & Reporting | Medium | All content modules |
| P2 | Notifications (in-app) | Medium | All modules |
| P2 | Announcements | Low | Admin tools |
| P2 | Admin Tools & Audit Log | Medium | All modules |
| P3 | Email/SMS digests | Low | Notifications |
| P3 | Aadhaar verification (live API integration) | Medium | Auth (stubbed first) |
| P3 | Crisis content auto-detection | Low | Moderation |

### Phase 2+ (future)

- WebSocket support for real-time DMs and notifications
- Multi-language support (i18n)
- Resource library module
- Workshop/events module
- Advanced matching/recommendation engine
- Mobile app (React Native) or PWA
- Elasticsearch for advanced search
- Analytics dashboard with anonymized impact reports

---

## 15. Developer Onboarding

### Prerequisites

- Docker Desktop (or Colima/Podman on macOS/Linux)
- Python 3.12+ (for IDE support; app runs in Docker)
- Git

### Getting Started

```bash
# 1. Clone the repo
git clone <repo-url> && cd healall/backend

# 2. Copy environment file
cp .env.example .env

# 3. Start all services
make up

# 4. Run database migrations
make migrate

# 5. Seed demo data
make seed

# 6. Open API docs
open http://localhost:8000/docs   # Swagger UI
open http://localhost:8000/redoc  # ReDoc

# 7. Run tests
make test
```

### Development Conventions

- **Branch naming:** `feat/auth-signup`, `fix/otp-rate-limit`, `chore/ci-config`
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **API versioning:** all routes under `/v1/`. When breaking changes are needed, create `/v2/` routes.
- **Code style:** enforced by Ruff (replaces Black + isort + flake8). Config in `pyproject.toml`.
- **Type hints:** use everywhere. Run `mypy` in CI (stretch goal).
- **Dependency management:** `uv` (fast, compatible with pip). `pyproject.toml` for deps.

---

## 16. Security Checklist

- [ ] All endpoints require authentication except: `POST /v1/auth/signup`, `POST /v1/auth/verify-otp`, `POST /v1/auth/token`, `GET /v1/feed` (public), `GET /v1/announcements` (public)
- [ ] Rate limiting on auth endpoints (5 OTP requests/hour per phone, 10 login attempts/hour per IP)
- [ ] CORS configured to allow only the frontend origin
- [ ] CSRF protection for cookie-based auth (double-submit cookie pattern)
- [ ] Input validation via Pydantic on every endpoint
- [ ] SQL injection prevention via SQLAlchemy parameterized queries (never raw string interpolation)
- [ ] XSS prevention: API returns JSON only; frontend is responsible for safe rendering
- [ ] File upload validation: content-type whitelist, size limits, virus scan (future)
- [ ] Secrets never in code: all via `.env` / environment variables
- [ ] Dependency scanning: `pip-audit` or Dependabot in CI
- [ ] No stack traces in production error responses (`APP_DEBUG=false`)
- [ ] Helmet-equivalent headers set by reverse proxy (X-Content-Type-Options, X-Frame-Options, etc.)

---

## 17. Example OpenAPI Snippet

```yaml
openapi: 3.0.3
info:
  title: HealAll API
  version: 1.0.0
  description: Backend API for the HealAll mutual-aid platform.

paths:
  /v1/auth/signup:
    post:
      summary: Register a new user (invite-only)
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, phone, email, city, age_range, invite_code, roles]
              properties:
                name: { type: string, maxLength: 120 }
                phone: { type: string, pattern: '^\+91\d{10}$' }
                email: { type: string, format: email }
                city: { type: string }
                age_range: { type: string, enum: ['13-17', '18-24', '25-34', '35-44', '45+'] }
                invite_code: { type: string }
                roles:
                  type: array
                  items: { type: string, enum: [helper, help_seeker] }
      responses:
        '201':
          description: User created, OTP sent
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string, format: uuid }
                  name: { type: string }
                  verification_level: { type: integer }
                  pending_verification: { type: array, items: { type: string } }
        '410':
          description: Invite code expired or invalid
        '429':
          description: Rate limited

  /v1/posts:
    post:
      summary: Create a new help request
      tags: [Posts]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title, description, category, urgency, city]
              properties:
                title: { type: string, maxLength: 200 }
                description: { type: string }
                category:
                  type: string
                  enum: [emotional_support, mentorship, skill_sharing, navigation, on_ground, urgent]
                urgency: { type: string, enum: [low, normal, high, critical] }
                city: { type: string }
                contact_prefs:
                  type: object
                  properties:
                    whatsapp: { type: boolean }
                    email: { type: boolean }
                    phone: { type: boolean }
      responses:
        '201':
          description: Post created in draft status
        '401':
          description: Not authenticated
        '403':
          description: User not verified (verification_level < 1)

  /v1/feed:
    get:
      summary: Browse verified help requests
      tags: [Feed]
      parameters:
        - { name: city, in: query, schema: { type: string } }
        - { name: category, in: query, schema: { type: string } }
        - { name: urgency, in: query, schema: { type: string } }
        - { name: search, in: query, schema: { type: string } }
        - { name: page, in: query, schema: { type: integer, default: 1 } }
        - { name: per_page, in: query, schema: { type: integer, default: 20, maximum: 50 } }
      responses:
        '200':
          description: Paginated list of active posts

  /v1/verification/{post_id}/verify:
    post:
      summary: Verify a help request (case verifier only)
      tags: [Verification]
      security:
        - bearerAuth: []
      parameters:
        - { name: post_id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [remarks]
              properties:
                remarks: { type: string }
                evidence_s3_key: { type: string }
      responses:
        '200':
          description: Post verified, case created
        '403':
          description: Not a case verifier

  /v1/cases/{case_id}/helpers:
    post:
      summary: Offer help on a case
      tags: [Cases]
      security:
        - bearerAuth: []
      parameters:
        - { name: case_id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '201':
          description: Help offered
        '409':
          description: Already offered help on this case

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

*This README is a living document. Update it as architecture decisions evolve. When in doubt, refer back to the [HealAll Brochure](./HealAll_Brochure_v1.pdf) and [Architecture README](./HealAll_Architecture_README_v1.md) for product-level guidance.*
