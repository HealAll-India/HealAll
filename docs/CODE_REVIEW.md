# Code Review: HealAll Backend

**Date**: 2026-03-07
**Scope**: Services and API endpoints for posts, cases, messages, moderation, users, comments, reports, verification
**Stack**: FastAPI + SQLAlchemy async + PostgreSQL

---

## Critical Bugs Found and Fixed

### 1. Unauthorized Access to Non-Public Posts (FIXED)

**File**: `/backend/app/api/v1/posts.py` — `GET /posts/{post_id}`
**Severity**: Critical — Information Disclosure

`post_service.get_post_by_id` only filters `deleted_at`. It does not filter by status. As a result, any authenticated user could fetch another user's post regardless of status — including `draft`, `submitted`, `needs_info`, and `rejected` posts — by guessing or knowing the post UUID.

The `PATCH /posts/{post_id}` and `POST /posts/{post_id}/submit` endpoints are safe because `post_service.update_post` and `post_service.submit_post` enforce `author_id` equality before acting. However the read endpoint had no such guard.

**Fix applied**: Added a visibility check in the `get_post` handler. Non-owners receive a 404 unless the post status is `active` or `resolved`. Imports were moved to the module level.

### 2. Unhandled `NoResultFound` on Soft-Deleted Post Author (FIXED)

**File**: `/backend/app/api/v1/posts.py` — `GET /posts/{post_id}`
**Severity**: Critical — Server Error (500)

The handler called `scalar_one()` when fetching the author by ID. If the author account has been soft-deleted (which is possible since `User` has a `deleted_at` column and the query had no `deleted_at` filter), SQLAlchemy raises `NoResultFound`, which FastAPI surfaces as an unhandled 500.

**Fix applied**: Changed to `scalar_one_or_none()` with an explicit 404 guard.

### 3. Self-Report Permitted (FIXED)

**File**: `/backend/app/services/report_service.py` — `create_report`
**Severity**: High — Logic Error / Data Integrity

The `create_report` function validated that the reported target existed and that the same reporter had not already filed a duplicate, but it allowed a user to submit a `target_type=USER` report with `target_id` equal to their own `reporter_id`. This would create a noise report in the moderation queue and could be exploited to game the report system.

**Fix applied**: Added a self-report guard immediately after target validation. Returns `ValidationException("You cannot report yourself")` when `target_type == USER` and `target_id == reporter_id`.

### 4. Moderator Privilege Escalation (FIXED)

**File**: `/backend/app/services/moderation_service.py` — `apply_moderation_action`
**Severity**: Critical — Privilege Escalation

`apply_moderation_action` accepted `acted_by` as a UUID with only a self-action guard (`acted_by == target_user_id`). A user with the `MODERATOR` role could suspend, restrict, or ban another `MODERATOR`, `ADMIN`, or even `HEAD_ADMIN`. The endpoint at `POST /moderation/actions` restricts access to moderators and above, but all roles in that set could act on each other.

**Fix applied**: After resolving `target_user`, the function now fetches the actor and enforces: if the actor does not hold `ADMIN` or `HEAD_ADMIN`, the action is rejected when the target holds any privileged role (`MODERATOR`, `ADMIN`, `HEAD_ADMIN`). Only admins can act on other privileged users.

### 5. Helpers Can Join Cases Pending Closure (FIXED)

**File**: `/backend/app/services/case_service.py` — `offer_help_on_case`
**Severity**: Medium — Business Logic Error

The guard blocking new helper membership only checked for `CaseStatus.CLOSED`. A user could offer help on a `CLOSURE_REQUESTED` case — one that the case owner or help-seeker has already flagged for closure and is awaiting verifier confirmation. This could create active helpers on a case that closes seconds later, producing orphaned memberships and incorrect helper counts.

**Fix applied**: Extended the guard to reject both `CLOSED` and `CLOSURE_REQUESTED` statuses.

---

## Authorization Analysis

### Properly Guarded (No Action Required)

| Endpoint | Check |
|---|---|
| `PATCH /posts/{post_id}` | `author_id == current_user.id` enforced in service |
| `DELETE /posts/{post_id}` | `author_id == current_user.id` enforced in service |
| `POST /posts/{post_id}/submit` | `author_id == current_user.id` enforced in service |
| `PATCH /cases/{case_id}` (owner assignment) | `VERIFIER_ROLES` check in service |
| `DELETE /cases/{case_id}/helpers/{user_id}` | Self, case owner, or verifier/admin |
| `POST /cases/{case_id}/close` | Author, case owner, or verifier/admin |
| `POST /cases/{case_id}/reopen` | Verifier/admin only |
| `POST /messages/consent/{id}/accept` | `to_user_id == current_user.id` |
| `POST /messages/consent/{id}/decline` | `to_user_id == current_user.id` |
| `GET /messages/conversations/{id}` | Participant check via `_assert_participant` |
| `POST /messages/conversations/{id}` | Participant check + block check |
| `DELETE /comments/{comment_id}` | Author or admin/head_admin |
| `POST /moderation/actions` | `require_any_role(MODERATION_ROLES)` |
| `GET /verification/queue` | `require_any_role(VERIFIER_ROLES)` |
| `POST /verification/{post_id}/verify` | `require_any_role(VERIFIER_ROLES)` |
| `PATCH /users/me` | Scoped to `current_user.id` |
| `DELETE /users/me/skills/{skill_id}` | `skill.user_id == user_id` enforced in service |

### Minor Authorization Notes (Not Fixed — Document Only)

- **`GET /cases/{case_id}/notes`**: Notes from authors whose accounts have since been soft-deleted are silently dropped from the response because `author_map[note.author_id]` would fail. The endpoint guards with `if note.author_id in author_map` but the dropped notes are not signalled to the caller. Acceptable for MVP but the API contract is implicit.

- **`GET /users/{user_id}`** (public profile): A blocked user receives `ForbiddenException`. The `ForbiddenException` import is done inline inside the handler function rather than at module level. This works but is inconsistent with the rest of the file. Not a bug.

---

## Performance Analysis

### N+1 Queries

No N+1 loops were found in the reviewed service layer. The codebase consistently uses:
- Subquery-based IN filters (e.g., block exclusion in `get_feed`)
- Batch user lookups via `_load_user_map` in `cases.py` and `comments.py`
- `_get_helper_counts` batched by `case_ids` list

### Observations

- `comment_service._get_hidden_author_ids` makes two sequential queries (blocked + blocked-by). These could be combined into one query with `OR` (as `user_service.is_user_blocked` already does), but the current approach is not an N+1 issue.
- `list_case_notes` in `cases.py` fetches notes then fetches all authors in one query — correct pattern.
- `get_feed` uses a subquery count before applying pagination — correct, avoids double full-scan.

---

## Exception Handling

### Unhandled Exception Surfaces

- The service layer uses custom `HealAllException` subclasses throughout. These must be mapped to HTTP responses by a global exception handler registered elsewhere in the application (not reviewed here). If that handler is absent or misconfigured, all domain exceptions will surface as 500s. The individual endpoints do not catch `HealAllException` themselves — this is by design if a global handler exists, but is a risk if it does not.

- `db.commit()` calls in API handlers are not wrapped in try/except. A commit-time integrity error (e.g., unique constraint violation that was not caught at flush time) will produce an unhandled 500. This is a structural risk across all endpoints.

---

## Input Validation

### Pydantic Schema Coverage

| Field | Constraint |
|---|---|
| `CreatePostRequest.title` | `min_length=5`, `max_length=200` |
| `CreatePostRequest.description` | `min_length=20`, `max_length=5000` |
| `CreatePostRequest.city` | `min_length=2`, `max_length=100` |
| `UpdatePostRequest` | Same constraints on non-null fields |
| `VerificationActionRequest.remarks` | `min_length=5`, `max_length=5000` |
| `Query(page, ge=1)` | All paginated endpoints |
| `Query(per_page, ge=1, le=50/100)` | All paginated endpoints |

### Gaps

- `AddSkillRequest.skill` — no visible length constraint in the schema. A very long string would be stored and potentially overflow `String(50)` at the DB layer if the column is narrow, or produce an oversized response if the column is `Text`. The column type was not reviewed but the schema should enforce `max_length`.
- `contact_prefs: dict[str, bool]` — the key is unconstrained. An attacker could POST an arbitrarily large JSONB payload. A `max_length` or item-count validator on the dict keys is advisable.
- `SendMessageRequest.body` — no `max_length` constraint visible. Messages are stored in a `Text` column with no size cap at the schema level.
- `CreateCommentRequest.body` — same as above.

---

## Business Logic Review

### Status Transition Map (Posts)

| From | Action | To | Guarded |
|---|---|---|---|
| `draft` / `needs_info` | submit | `submitted` | Yes — service checks status |
| `draft` / `needs_info` | update | same | Yes — service checks status |
| `submitted` / `needs_info` | verify | `active` | Yes — `VERIFICATION_ALLOWED_FROM` set |
| `submitted` / `needs_info` | needs_info | `needs_info` | Yes |
| `submitted` / `needs_info` | reject | `rejected` | Yes |

The transition guards are correct. A post already in `submitted` status cannot be re-submitted (guard in `submit_post`). A post in `active` or `resolved` cannot be edited (guard in `update_post`).

### Status Transition Map (Cases)

| From | Action | To | Guarded |
|---|---|---|---|
| `active` / `reopened` | close (verifier) | `closed` | Yes |
| `active` / `reopened` | close (owner/author) | `closure_requested` | Yes |
| `closure_requested` | close (verifier) | `closed` | Yes — status checked |
| `closed` / `closure_requested` | reopen | `reopened` | Yes — verifier/admin only |
| `closed` | offer_help | blocked | Yes (after fix) |
| `closure_requested` | offer_help | blocked | Yes (after fix) |

Note: A verifier can call `close_case` on a case that is already in `closure_requested` and transition it directly to `closed` — this is intended behavior based on the service logic.

---

## Missing Endpoint

The `get_feed` service function (`post_service.get_feed`) with full filter support (city, category, urgency, search, block exclusion, pagination) exists in the service layer but is not exposed by any API endpoint. The `GET /posts` route currently returns the authenticated user's own posts (`get_my_posts`). A public feed endpoint needs to be added if users are expected to browse active help requests.

---

## Overall Quality Assessment

**Strengths**:
- Consistent use of soft-delete patterns across Post, User, and Comment models.
- Authorization is enforced at the service layer (not just the route layer), providing defense-in-depth.
- Block relationships are checked bidirectionally and consistently across messages, comments, and the feed.
- The consent-based messaging flow correctly validates pending state before accepting/declining.
- Pagination is consistently applied with count queries before data queries.
- Role-based access is centralized in `deps.py` and reused cleanly via `require_any_role`.

**Weaknesses**:
- No global exception handler was visible in this review scope; DB-level errors at commit time will produce raw 500s.
- Several text fields (message body, comment body, skill name) lack `max_length` validation at the Pydantic layer.
- The public feed service exists but is unreachable — either a missing route or an intentional MVP deferral that should be tracked.
- Inline imports inside handler functions (e.g., `ForbiddenException` in `users.py`) indicate incremental additions without cleanup.

**Rating**: The codebase is well-structured and follows consistent patterns. The four critical bugs fixed above were the primary correctness and security risks. With those resolved and the input validation gaps addressed, the backend is suitable for guarded beta use.
