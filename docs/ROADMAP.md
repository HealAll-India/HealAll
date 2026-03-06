# HealAll — Development Roadmap

**Project:** HealAll — Volunteer-driven mutual-aid platform (India-first, web-only, invite-only)
**Last updated:** 2026-03-07
**Stack:** Python 3.12 + FastAPI + PostgreSQL (backend) | Next.js 15 + TypeScript + Tailwind (frontend)

---

## Module Status Overview

| Module | Area | Backend | Frontend | Tests |
|--------|------|---------|----------|-------|
| 1 | Auth & Identity (invite codes, OTP, JWT, RBAC) | Complete | Complete | Partial |
| 2 | User Profiles (CRUD, skills, privacy) | Complete | Complete | None |
| 3 | Posts & Feed (create, filters, pagination) | Complete | Complete | None |
| 4 | Cases (lifecycle, notes, helpers, status transitions) | Complete | Complete | None |
| 5 | Messaging (DM consent, conversations, messages) | Complete | Complete | None |
| 6 | Moderation (reports, suspend, review queue) | Complete | Complete | None |
| — | Comments | Complete | Complete | None |
| — | Verification (Aadhaar stub) | Stub only | Complete | None |
| — | Notifications | Stub only | — | None |
| — | Celery background workers | Designed | — | None |
| — | CI/CD pipeline | Not started | — | — |

---

## Phase 1 — Core Platform (COMPLETE)

**Goal:** Implement all backend modules, API routes, database migrations, and the full frontend page set.

### Backend
- Auth & Identity: invite code validation, OTP signup, JWT + refresh token rotation, role-based access control
- User Profiles: profile CRUD, skills list, privacy settings, blocking
- Posts & Feed: post creation, editing, submission, feed endpoint with filters and cursor pagination
- Cases: case lifecycle state machine, case notes, helper assignment, status transitions
- Messaging: DM consent flow, conversation management, message send/receive
- Moderation: report submission, suspend/unsuspend users, moderator review queue
- Supporting services: comments, verification stub, invite management, notification stub
- 6 Alembic migrations applied

### Frontend
- Auth pages: `/signup`, `/login`, `/verify-otp`
- App pages: `/feed`, `/posts/new`, `/posts/[postId]`, `/cases`, `/cases/[caseId]`, `/messages`, `/messages/[conversationId]`, `/profile`, `/profile/[userId]`
- Admin pages: `/admin/dashboard`, `/admin/verification-queue`, `/admin/moderation`, `/admin/users`, `/admin/invites`
- Full API client layer (`lib/api/*.ts`) covering all backend modules
- Zustand auth store

### Infrastructure
- Docker Compose: PostgreSQL 15, Redis 7, MinIO
- Environment: local dev fully operational

---

## Phase 2 — Testing & Quality (IN PROGRESS)

**Goal:** Achieve meaningful test coverage across all modules to support safe iteration and production deployment.

**Status:** Two test files exist. Modules 2–6 have zero coverage. This is the current active work stream.

### 2.1 Backend Integration Tests

Priority order mirrors the criticality of each module.

| Test file | Module covered | Status |
|-----------|---------------|--------|
| `tests/test_health.py` | Health check | Done |
| `tests/integration/test_auth_flow.py` | Module 1 — Auth | Done |
| `tests/integration/test_users.py` | Module 2 — Profiles | To do |
| `tests/integration/test_posts.py` | Module 3 — Posts & Feed | To do |
| `tests/integration/test_cases.py` | Module 4 — Cases | To do |
| `tests/integration/test_messaging.py` | Module 5 — Messaging | To do |
| `tests/integration/test_moderation.py` | Module 6 — Moderation | To do |
| `tests/integration/test_comments.py` | Comments | To do |
| `tests/integration/test_invites.py` | Invites | To do |

Each integration test suite must cover: happy path, auth guard enforcement, validation errors, and state transition edge cases.

### 2.2 Frontend Component Tests

- Set up Vitest + React Testing Library
- Unit tests for all shared UI components
- Tests for auth store (Zustand) — login, logout, token refresh
- Tests for API client error handling and retry logic

### 2.3 End-to-End Tests

- Set up Playwright
- E2E scenarios: signup via invite code, post creation and feed, case assignment, direct message consent flow, admin moderation action
- Run against a Docker-composed test environment

### Exit Criteria for Phase 2
- Backend integration test coverage >= 80% across all modules
- All critical user journeys covered by at least one E2E test
- Zero failing tests in CI (once CI is set up in Phase 4)

---

## Phase 3 — Production Readiness (NEXT)

**Goal:** Replace all stubs with real third-party integrations, add background job infrastructure, and harden the HTTP layer.

### 3.1 Notifications — Real SMS Provider

- Integrate MSG91 (primary, India) or Twilio (fallback) for OTP and alert SMS
- Replace the current console-log stub in `notification_service` with a provider client
- Store provider response IDs for delivery tracking
- Add retry logic and failure logging
- Configuration via environment variables; no credentials in source

### 3.2 Notifications — Real Email Provider

- Integrate SMTP (self-hosted) or AWS SES for transactional email
- Templates: invite email, account welcome, case status update, moderation action
- Unsubscribe handling for non-transactional notifications

### 3.3 Celery Background Workers

- Stand up Celery with Redis as the broker (Redis is already in Docker Compose)
- Task queues: notification dispatch, report processing, case status digest, invite expiry
- Add Celery Beat for scheduled jobs (e.g., expire old invite codes, summarise daily case activity)
- Flower dashboard for worker monitoring in development
- Integrate Celery worker container into Docker Compose

### 3.4 HTTP-Level Rate Limiting

- Current rate limiting sits at the service layer only
- Add middleware-level rate limiting (slowapi or a Nginx/Caddy upstream rule)
- Apply per-IP and per-user limits on auth endpoints (OTP, login) and write endpoints
- Return `429 Too Many Requests` with `Retry-After` header

### 3.5 Aadhaar Verification Integration

- Replace the Aadhaar stub with a call to a licensed KYC provider (e.g., Digio or SignDesk)
- Implement webhook receiver for async verification callbacks
- Store verification status and provider reference ID; never store raw Aadhaar numbers
- Gate volunteer assignment on verified status

---

## Phase 4 — Observability & CI/CD

**Goal:** Automate quality gates on every pull request and provide full production visibility.

### 4.1 GitHub Actions CI Pipeline

- Trigger on every pull request targeting `main`
- Jobs (run in parallel where independent):
  - `lint` — ruff (backend), ESLint + tsc (frontend)
  - `test-backend` — pytest with Docker service for PostgreSQL and Redis
  - `test-frontend` — Vitest
  - `e2e` — Playwright against Docker Compose stack
- Fail the PR if any job fails
- Publish test coverage report as a PR comment

### 4.2 Sentry Error Tracking

- Instrument FastAPI with `sentry-sdk` (ASGI integration)
- Instrument Next.js with `@sentry/nextjs`
- Capture unhandled exceptions and slow transactions
- Set alert thresholds for error rate spikes
- DSN and environment tag via environment variables only

### 4.3 Prometheus + Grafana Metrics

- Expose `/metrics` from FastAPI via `prometheus-fastapi-instrumentator`
- Key metrics: request rate, error rate (4xx/5xx), response latency (p50/p95/p99), active DB connections, Celery queue depth
- Docker Compose additions: Prometheus scrape config, Grafana with pre-built dashboard
- Alert rules: error rate > 5%, p95 latency > 2s, queue depth > 500

### 4.4 Production Deployment Guide

- Target environment: single VPS (2 vCPU, 4 GB RAM minimum) running Ubuntu 24.04
- Reverse proxy: Caddy (automatic HTTPS via Let's Encrypt)
- Runtime: Docker Compose with production overrides (`docker-compose.prod.yml`)
- Secrets management: environment file injected at deploy time, never committed
- Database: PostgreSQL with daily `pg_dump` to off-host storage (S3-compatible)
- Runbook covering: first deploy, rollback procedure, DB migration procedure, secret rotation
- Document in `/docs/DEPLOYMENT.md`

---

## Phase 5 — Scale & Features

**Goal:** Extend platform capabilities once the production baseline is stable.

### 5.1 Real-Time Notifications

- Evaluate WebSockets (via FastAPI + `websockets`) vs. Server-Sent Events (SSE)
- Use case: new message received, case status changed, moderation action on owned post
- SSE preferred for unidirectional server-push; WebSockets if bidirectional is needed
- Redis Pub/Sub as the fan-out bus between Celery workers and connected clients

### 5.2 File Uploads via MinIO

- MinIO is already in Docker Compose but unused
- Implement presigned URL flow: client requests a presigned PUT URL from the backend, uploads directly to MinIO, then confirms upload to the backend
- Use cases: profile photo, case evidence attachments, post images
- Enforce file type validation, size limits, and virus scan (ClamAV or cloud equivalent) before marking an upload as accepted
- Serve files via presigned GET URLs with short TTL

### 5.3 Admin Dashboard Enhancements

- Platform-wide metrics cards (active users, open cases, pending verifications, report volume)
- Bulk moderation actions (bulk suspend, bulk invite revocation)
- Invite tree visualisation (who invited whom)
- Export: CSV download of cases and user roster for offline reporting

### 5.4 Mobile App (Future)

- No commitment until Phase 4 is complete and the platform has active users
- Candidate approach: React Native (shares TypeScript types and API client patterns with the web frontend)
- Prerequisite: define and stabilise a versioned public API contract (OpenAPI spec enforced in CI)

---

## Dependency Graph

```
Phase 1 (Complete)
    |
    v
Phase 2 (Testing) -----> Phase 4 (CI/CD) depends on tests existing
    |
    v
Phase 3 (Production Readiness)
    |
    v
Phase 4 (Observability & CI/CD)
    |
    v
Phase 5 (Scale & Features)
```

Phase 3 and Phase 4 can proceed in parallel once Phase 2 backend integration tests reach 60%+ coverage. Phase 5 items are independent of each other and can be sequenced based on user demand.

---

## Immediate Next Actions

1. Write `tests/integration/test_users.py` — Module 2 profile CRUD and privacy enforcement
2. Write `tests/integration/test_posts.py` — post lifecycle and feed pagination
3. Write `tests/integration/test_cases.py` — state machine transitions and helper assignment
4. Write `tests/integration/test_messaging.py` — DM consent and message delivery
5. Write `tests/integration/test_moderation.py` — report flow and suspension
6. Set up MSG91 sandbox account and wire to `notification_service`
7. Stand up Celery worker and move OTP dispatch off the request thread
8. Create `.github/workflows/ci.yml` with lint and test jobs
