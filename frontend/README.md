# HealAll Frontend (Modules 1-6)

This frontend is a Next.js App Router implementation wired to the FastAPI backend through Module 6.

## Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
```

Default URL: `http://localhost:3000`

Backend URL is configured by `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).

## Quality checks

```bash
npm run typecheck
npm run build
```

## Implemented routes

### Module 1: Auth & Identity
- `/signup`
- `/verify-otp`
- `/login`
- `/invites` (admin invite management)

### Module 2: User Profile & Settings
- `/profile`

### Module 3: Posts & Feed
- `/feed`
- `/posts/new`
- `/posts/[postId]`

### Module 4: Cases + Verification Queue
- `/cases`
- `/cases/[caseId]`
- `/admin/verification`

### Module 5: Comments & Messaging
- `/posts/[postId]` (comments)
- `/messages`
- `/messages/[conversationId]`

### Module 6: Reports & Moderation
- `/posts/[postId]` (report submission)
- `/admin/moderation`

## Notes
- Access token is stored in Zustand persisted state (`localStorage`).
- API calls include `credentials: include` so refresh cookie/session behavior remains compatible.
- Pages requiring auth show a prompt linking to login/signup when no token is present.
