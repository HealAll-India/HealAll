# 🌿 HealAll — Help and be helped by your community

<div align="center">

[![Live](https://img.shields.io/badge/🌐%20live-healallindia.com-22c55e?style=for-the-badge)](https://healallindia.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome%20🙌-brightgreen?style=for-the-badge)](https://github.com/anupam8nith/HealAll/pulls)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Made in India](https://img.shields.io/badge/Made%20in-India%20🇮🇳-FF9933?style=for-the-badge)](https://healallindia.com)

**India's invite-only mutual-aid platform. Real people. Real help. Real community.**

[🌍 Visit HealAll](https://healallindia.com) • [📖 Docs](docs/) • [🐛 Report Bug](https://github.com/anupam8nith/HealAll/issues) • [💡 Request Feature](https://github.com/anupam8nith/HealAll/issues) • [🤝 Contribute](#-contributing--we-want-you)

</div>

---

## 🙏 What is HealAll?

HealAll is an **invite-only mutual-aid platform built for India**. When someone needs blood at 2am, emergency shelter after a flood, medicine money for a sick parent, or simply a job connection — HealAll is where the community shows up.

Unlike social media algorithms that bury real needs under viral content, HealAll is built around **intentional community**. Every member is invited by someone they know. Every post is verified before going live. Every request for help reaches people who genuinely care — not just followers.

We believe that the most powerful social safety net isn't the government or an NGO. It's your neighbours, batchmates, colleagues, and community members — if only they had a structured, trusted way to help each other. That's HealAll.

> 💬 *"Most Indians have survived hardship not because of systems, but because of people. HealAll just makes that network legible."*

---

## ✨ The Problem We Solve

Most apps optimise for engagement. We optimise for **human outcomes**.

- 🩸 **Blood emergencies** — A relative needs 4 units of O− in Jaipur at midnight. Who has it? Who can donate? HealAll surfaces the right people in minutes.
- 🌊 **Disaster relief** — After a cyclone, families need shelter, food, and medicine. HealAll lets communities coordinate without bureaucracy.
- 💊 **Medical bills** — Cancer treatment costs more than a family earns in a year. Verified needs, not charity spam.
- 🎓 **Mentorship & navigation** — First-generation college student needs guidance. A career changer needs someone who's done it. HealAll connects them with people who remember where they came from.
- 🔧 **Skills on the ground** — A carpenter, electrician, or nurse can give one hour. Someone nearby needs exactly that.

---

## 🏗️ Architecture at a Glance

```
                         🌍 Internet
                              │
                    ┌─────────▼─────────┐
                    │   Cloudflare CDN  │  DNS · DDoS · WAF · SSL
                    └────────┬──────────┘
                   ┌─────────┴──────────┐
                   │                    │
          ┌────────▼──────┐    ┌────────▼────────┐
          │  Vercel (FE)  │    │  Railway (BE)   │
          │  Next.js 16   │    │  FastAPI + Uvi  │
          │  healallindia │    │  api.healall... │
          └───────────────┘    └───┬─────────┬───┘
                                   │         │
                    ┌──────────────┘         └──────────────┐
                    │                                        │
          ┌─────────▼──────────┐              ┌─────────────▼────────┐
          │   Neon PostgreSQL  │              │   Upstash Redis      │
          │   (async pooled)   │              │   (rate-limit + cache)│
          └────────────────────┘              └──────────────────────┘
                    │
          ┌─────────▼──────────┐
          │  Cloudflare R2     │
          │  (media + identity │
          │   document store)  │
          └────────────────────┘
```

---

## 🚀 Feature Modules

| Module | What it does | Status |
|--------|-------------|--------|
| 🔐 **Auth & Invite Codes** | OTP via SMS/email, JWT + refresh tokens, RBAC (User/Moderator/Admin/HeadAdmin) | ✅ Live |
| 📝 **Posts & Feed** | Create requests, filtered public feed, soft-delete, submit for verification | ✅ Live |
| 📋 **Cases** | Full lifecycle (open → helpers → closure request → closed), notes, case helpers | ✅ Live |
| 💬 **Messaging** | Consent-gated DMs (must request before messaging), threaded conversations | ✅ Live |
| 🛡️ **Moderation** | Reports, warn/suspend/ban, role hierarchy (moderators can't touch admins) | ✅ Live |
| 💭 **Comments** | Threaded comments on posts with soft-delete | ✅ Live |
| 👁️ **Verification Queue** | Admin reviews posts before they go live on the feed | ✅ Live |
| 🪪 **Aadhaar Verification** | Identity verification pipeline (stub → real integration) | 🚧 Stub |
| 📣 **Notifications** | SMS + email OTP and alerts (MSG91 + SMTP, stub until wired) | 🚧 Stub |
| 📁 **File Uploads** | MinIO/R2 presigned URL upload routes (routes ready, not wired to UI) | 🚧 Coming |
| ⚙️ **Celery Workers** | Background job processing (defined, not deployed) | 🚧 Coming |

---

## 🛠️ Tech Stack

<table>
<tr>
<td valign="top" width="50%">

### 🐍 Backend
- **Python 3.12** + **FastAPI 0.136**
- **SQLAlchemy 2.0** (fully async)
- **Alembic** — database migrations
- **asyncpg** — async PostgreSQL driver
- **Pydantic v2** — validation & settings
- **python-jose** — JWT tokens
- **passlib + bcrypt** — password hashing
- **Celery + Redis** — background jobs
- **boto3** — S3/R2 object storage
- **structlog** — structured logging
- **sentry-sdk** — error tracking (ready)
- **slowapi** — rate limiting

</td>
<td valign="top" width="50%">

### ⚛️ Frontend
- **Next.js 16** (App Router, TypeScript)
- **React 19**
- **Tailwind CSS** — styling
- **Zustand** — global auth state
- **TanStack Query** — server state
- **TypeScript 5.9**

### ☁️ Infrastructure
- **Railway** — backend hosting
- **Vercel** — frontend hosting
- **Neon** — serverless PostgreSQL
- **Upstash** — serverless Redis
- **Cloudflare R2** — object storage
- **Cloudflare** — DNS, CDN, WAF

</td>
</tr>
</table>

---

## 🏠 Self-Host in 5 Minutes

**Prerequisites**: Docker, Python 3.12, Node.js 18+

```bash
# 1. Clone
git clone https://github.com/anupam8nith/HealAll.git
cd HealAll

# 2. Backend setup
cd backend
cp .env.example .env          # fill in your values
make up                        # starts PostgreSQL + Redis + MinIO
make migrate                   # runs all 6 Alembic migrations
make seed                      # creates admin user + sample invite codes
make dev                       # API running at http://localhost:8000

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev                    # running at http://localhost:3000

# 4. Verify
curl http://localhost:8000/health
# → {"status":"healthy","version":"0.1.0"}
```

**Required env vars** (see `backend/.env.example`):
```
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
JWT_SECRET_KEY=<random 64-char hex>
APP_SECRET_KEY=<random 64-char hex>
S3_ENDPOINT_URL=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

---

## 🗺️ Roadmap

### ✅ Phase 1 — Core Platform (Complete)
All backend modules, API routes, 6 database migrations, full frontend with all pages.

### 🔄 Phase 2 — Test Coverage (In Progress)
Integration tests for all 7 modules. 0% → 80%+ coverage.

### 🔜 Phase 3 — Production Readiness
- [ ] Wire MSG91 SMS + SMTP email
- [ ] Deploy Celery worker (move OTP off request thread)
- [ ] GitHub Actions CI/CD
- [ ] Sentry error tracking
- [ ] File upload UI

### 🔮 Phase 4 — Scale & Observability
- [ ] Prometheus + Grafana dashboards
- [ ] WebSocket live notifications
- [ ] Admin analytics dashboard
- [ ] Horizontal scaling config

### 🌠 Phase 5 — Mobile & Growth
- [ ] React Native / Flutter mobile app
- [ ] Aadhaar real verification pipeline
- [ ] Regional language support (Hindi, Tamil, Telugu)
- [ ] NGO/organization accounts

---

## 🤝 Contributing — We Want You!

**HealAll is open source and we actively welcome contributors.** Whether you're a seasoned engineer or writing your first pull request, there's a meaningful place for you here.

> 💡 This isn't a side project with stale issues. It's a live platform with real users and a clear roadmap. Your contribution ships to production.

### 🎯 Where to Start

| Area | What's needed | Skill | Difficulty |
|------|--------------|-------|------------|
| 🧪 **Tests** | pytest integration tests for 6 untested modules | Python | 🟢 Easy |
| 📣 **SMS/Email** | Wire MSG91 + SMTP to `notification_service.py` | Python | 🟡 Medium |
| ⚙️ **CI/CD** | GitHub Actions workflow: lint + test + deploy | YAML | 🟢 Easy |
| 🪲 **Sentry** | Init sentry-sdk in main.py, add DSN to Railway | Python | 🟢 Easy (1 day) |
| 🔄 **Celery** | Wire OTP tasks, deploy worker on Railway | Python/DevOps | 🟡 Medium |
| 📱 **Mobile** | React Native or Flutter app | RN/Flutter | 🔴 Hard |
| 🪪 **Aadhaar** | Real Aadhaar verification API integration | Python/API | 🔴 Hard |
| 🌐 **i18n** | Hindi/Tamil/Telugu translations | Frontend/TS | 🟡 Medium |
| 🎨 **UI Polish** | Improve feed, post cards, mobile responsiveness | Next.js/CSS | 🟡 Medium |
| 📖 **Docs** | API docs, architecture diagrams, guides | Markdown | 🟢 Easy |

### 📋 How to Contribute

```bash
# 1. Fork the repo on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/HealAll.git
cd HealAll

# 3. Create a feature branch
git checkout -b feat/your-feature-name

# 4. Set up local dev (see Self-Host section above)
cd backend && make up && make migrate && make dev

# 5. Make your changes. Run tests before pushing:
make test          # backend tests
make lint          # linting + type check
cd ../frontend && npm run lint && npm run build

# 6. Commit with a clear message
git commit -m "feat: add MSG91 SMS integration"

# 7. Push and open a PR
git push origin feat/your-feature-name
# → Open PR on GitHub → describe what and why
```

### 📌 Contribution Guidelines

- **One PR = one thing.** Don't bundle refactors with features.
- **No mock DB in tests.** Tests hit a real PostgreSQL (Docker). See `CLAUDE.md` for test patterns.
- **Security guards are sacred.** Never remove visibility checks, self-report guards, or role-hierarchy checks. See `docs/CODE_REVIEW.md`.
- **Service layer never commits.** `db.flush()` in services, `db.commit()` in routes only.
- **File length limit: ~500 lines.** Split at natural seams.

### 💬 Getting Help

- Open a [GitHub Discussion](https://github.com/anupam8nith/HealAll/discussions) for questions
- Tag issues with `good first issue` for beginner-friendly tasks
- Read `CLAUDE.md` for non-obvious architecture rules
- Read `docs/CODE_REVIEW.md` for security patterns to preserve

---

## 🔐 Security

HealAll handles sensitive community data. We take security seriously.

**Built-in protections:**
- 🛡️ Defence-in-depth RBAC at both route and service layer
- 👁️ Post visibility guards (drafts invisible to non-owners)
- 🚫 Self-report prevention
- 📊 Role hierarchy enforcement (moderators cannot act on admins)
- 🔒 Consent-gated messaging (no cold DMs)
- ⏱️ Rate limiting via Redis + slowapi

**Responsible disclosure:** Found a security bug? Please email `security@healallindia.com` before opening a public issue. We take all reports seriously and will respond within 48 hours.

---

## 📂 Repository Structure

```
HealAll/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/v1/           # Route handlers (auth, posts, feed, cases, ...)
│   │   ├── services/         # Business logic layer
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── core/             # Config, exceptions, security
│   │   └── db/               # Engine + session
│   ├── alembic/              # Database migrations (6 versions)
│   ├── tests/                # Integration tests (real DB, no mocks)
│   ├── start.sh              # Production start: migrate → uvicorn
│   ├── Dockerfile
│   └── Makefile
├── frontend/                 # Next.js 16 application
│   ├── app/                  # App Router pages
│   ├── components/           # Shared UI components
│   └── lib/api/              # Type-safe API client layer
├── docs/
│   ├── ROADMAP.md
│   ├── CODE_REVIEW.md        # Security audit + bugs fixed
│   ├── DEPLOYMENT.md         # How to deploy + monitor
│   └── ACTIVITY_LOG.md       # Change log per agent session
└── CLAUDE.md                 # Architecture rules (non-obvious)
```

---

## 📜 License

MIT License — see [LICENSE](LICENSE). Use it, fork it, build on it. Just don't use it to exploit communities.

---

## 💚 Made with love for India

Built by volunteers who believe that technology should strengthen communities, not extract from them.

**HealAll is free, open-source, and will remain so.**

If you're using HealAll or building on it, we'd love to know. Star the repo ⭐ and share it with someone who might want to contribute.

---

<div align="center">

🌿 **[healallindia.com](https://healallindia.com)** • Built with ❤️ in India

*"The strength of a community is measured by how it treats its most vulnerable members."*

</div>
