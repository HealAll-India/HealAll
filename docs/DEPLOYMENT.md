# HealAll — Deployment & Operations Guide

> **Live URLs**: Frontend → [healallindia.com](https://healallindia.com) · Backend API → [api.healallindia.com](https://api.healallindia.com/health)

---

## Architecture Overview

```
User Browser
    │
    ▼
┌──────────────────────────────────────────────────┐
│             Cloudflare (Free tier)               │
│   DNS · CDN · WAF · DDoS protection · SSL        │
└──────────┬───────────────────────────┬───────────┘
           │ healallindia.com          │ api.healallindia.com
           │ (Proxied 🟠)              │ (DNS-only ⚪)
           ▼                           ▼
┌─────────────────┐         ┌─────────────────────┐
│  Vercel (Free)  │         │  Railway (Hobby ~$5) │
│  Next.js 16 SSR │         │  FastAPI + Uvicorn   │
│  14 routes      │         │  Python 3.12         │
│  Edge Network   │         │  start.sh: migrate   │
└─────────────────┘         │  → uvicorn start     │
                            └──────┬──────┬────────┘
                                   │      │
                     ┌─────────────┘      └──────────────┐
                     ▼                                    ▼
          ┌──────────────────┐              ┌─────────────────────┐
          │  Neon (Free)     │              │  Upstash (Free)     │
          │  PostgreSQL 17   │              │  Redis 7 (TLS)      │
          │  Serverless pool │              │  Rate limiting      │
          │  ap-southeast-1  │              │  Session cache      │
          └──────────────────┘              └─────────────────────┘
                     │
          ┌──────────▼──────────┐
          │  Cloudflare R2      │
          │  healall-media      │
          │  healall-identity   │
          │  (presigned URLs)   │
          └─────────────────────┘
```

---

## Service Dashboards & Where to Check

### 1. 🚂 Railway — Backend Hosting

**Dashboard**: https://railway.com/project/1377e5f4-9af5-46d9-925a-32b6145ba33f

| What to check | Where to find it | What's healthy |
|--------------|-----------------|----------------|
| Deploy status | Deployments tab → latest entry | Green "Success" |
| Runtime logs | Deployments → click latest → View Logs | No ERROR lines |
| Env vars | Service → Variables tab | All keys present |
| CPU / RAM | Service → Metrics tab | <80% avg |
| Build logs | Deployments → Build Logs | No failed steps |

**CLI checks** (from repo root):
```bash
railway status                          # linked project/service
railway logs --tail 100                 # last 100 log lines
railway variables                       # all env vars
curl https://api.healallindia.com/health # → {"status":"healthy"}
```

**Deploy commands:**
```bash
# Manual deploy (push latest code)
cd ~/Desktop/HealAll
git add . && git commit -m "fix: ..." && git push origin main
railway up --detach                    # triggers new build

# Watch deployment
railway logs --build --tail 50         # build output
railway logs --tail 50                 # runtime output
```

**What a healthy deploy looks like in logs:**
```
Starting Container
==> Running database migrations...
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Running upgrade ... (only if schema changed)
==> Starting application...
INFO:     Started server process [1]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8080
```

**Cost**: Railway Hobby = $5 free credit/month. HealAll at idle: ~$1–3/month.
- Railway → Project → Usage tab shows real-time spend
- Exceeds $5 → billed at $0.000231/vCPU-min + $0.000000231/GB-min RAM

---

### 2. ▲ Vercel — Frontend Hosting

**Dashboard**: https://vercel.com/anupamkumarnith-1461s-projects/frontend

| What to check | Where to find it | What's healthy |
|--------------|-----------------|----------------|
| Deploy status | Deployments tab | "Ready" (green) |
| Build output | Deployments → click → Build Logs | All 14 routes compiled |
| Function logs | Deployments → Runtime Logs | No 500 errors |
| Domain status | Settings → Domains | Green checkmark |
| Bandwidth | Settings → Usage | <100GB/month (free) |

**CLI checks:**
```bash
cd ~/Desktop/HealAll/frontend
vercel deployments ls                  # list recent deploys
vercel domains ls                      # domain health
vercel logs <deployment-url>           # runtime logs
```

**Deploy command:**
```bash
cd ~/Desktop/HealAll/frontend
vercel --prod --yes -e NEXT_PUBLIC_API_BASE_URL=https://api.healallindia.com
```

**Auto-deploy setup** (recommended — one-time):
Vercel Dashboard → Project → Settings → Git → Connect GitHub → select `anupam8nith/HealAll` → Root Directory: `frontend` → Save. Every push to `main` auto-deploys.

**Cost**: Hobby = free. Limits:
- 100GB bandwidth/month → upgrade to Pro ($20/mo) if exceeded
- 100 deployments/day (plenty)
- Serverless function invocations: 100GB-hours/month free

---

### 3. 🐘 Neon — PostgreSQL Database

**Dashboard**: https://console.neon.tech/app/projects/raspy-forest-55148278

| What to check | Where to find it | What's healthy |
|--------------|-----------------|----------------|
| Migration version | SQL Editor → `SELECT version_num FROM alembic_version;` | `007` |
| Table count | SQL Editor → `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';` | `20` |
| Active connections | Monitoring → Connections | <20 (pooled) |
| Query latency | Monitoring → Latency | <50ms avg |
| Storage used | Project → Storage | <512MB (free tier) |

**Check migration status:**
```sql
-- Run in Neon SQL Editor
SELECT version_num FROM alembic_version;
-- Expected: 006

-- Verify all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Important**: Neon auto-suspends after 5 minutes of inactivity. First request after idle takes ~500ms (cold start). This is normal on the free tier.

**Cost**: Free tier includes:
- 0.5 CU compute, 190 compute hours/month
- 512MB storage, 3GB data transfer
- HealAll current usage: <10 compute hrs/month (well within free)
- Upgrade to Launch ($19/mo) if compute hours exceeded

---

### 4. 🔴 Upstash — Redis

**Dashboard**: https://console.upstash.com → select your database

| What to check | Where to find it | What's healthy |
|--------------|-----------------|----------------|
| Daily commands | Database → Details → Daily Commands | <10,000/day (free) |
| Connection count | Database → Details | <100 |
| Latency | Database → Details → Latency | <5ms |

**Cost**: Free tier = 10,000 commands/day, 256MB storage.
- Each API request uses ~1–3 Redis commands (rate limiting)
- At 5,000 requests/day → ~10,000–15,000 commands → upgrade if exceeded
- Pay-as-you-go: $0.20 per 100,000 commands above free tier

---

### 5. ☁️ Cloudflare R2 — Object Storage

**Dashboard**: Cloudflare Dashboard → R2 → Buckets

| Bucket | Purpose |
|--------|---------|
| `healall-media` | User posts, profile photos |
| `healall-identity-ephemeral` | Aadhaar documents (ephemeral, auto-deleted) |

| What to check | Where | What's healthy |
|--------------|-------|----------------|
| Object count | Bucket → Metrics | Grows over time |
| Storage used | Bucket → Metrics | <10GB (free) |
| Class A ops | Metrics | <1M/month (free) |

**Cost**: R2 free tier:
- 10GB storage
- 1M Class A operations (writes)/month
- 10M Class B operations (reads)/month
- **Zero egress fees** (unlike AWS S3)
- Upgrade: $0.015/GB-month storage, $4.50/M Class A ops

---

### 6. 🔶 Cloudflare DNS

**Dashboard**: Cloudflare → healallindia.com → DNS

**Current records:**

| Type | Name | Target | Proxy | Purpose |
|------|------|--------|-------|---------|
| `A` | `@` (root) | `76.76.21.21` | 🟠 Proxied | healallindia.com → Vercel |
| `A` | `www` | `76.76.21.21` | 🟠 Proxied | www.healallindia.com → Vercel |
| `CNAME` | `api` | `m9eweo1y.up.railway.app` | ⚪ DNS-only | api.healallindia.com → Railway |
| `TXT` | `_railway-verify.api` | `railway-verify=...` | ⚪ DNS-only | Railway domain verification |

**Why `api` is DNS-only (not proxied)**: Railway handles its own TLS termination. Double-proxying through Cloudflare causes SSL certificate conflicts (error 525). Leave it grey.

---

## How to Deploy

### Backend — Deploy New Code

```bash
cd ~/Desktop/HealAll

# 1. Make your changes
# 2. Commit
git add backend/
git commit -m "fix: your change description"
git push origin main

# 3. Trigger Railway deploy
railway up --detach

# 4. Watch logs (wait ~2 min for build)
railway logs --tail 100

# 5. Verify
curl https://api.healallindia.com/health
```

### Frontend — Deploy New Code

```bash
cd ~/Desktop/HealAll/frontend

# Option A: CLI deploy
vercel --prod --yes -e NEXT_PUBLIC_API_BASE_URL=https://api.healallindia.com

# Option B (after connecting GitHub in Vercel): just push to main
git push origin main  # Vercel auto-deploys
```

### Database Migrations — Schema Changes

```bash
# 1. Create migration (auto-detects model changes)
cd backend
alembic revision --autogenerate -m "add_notification_preferences"

# 2. Review the generated file in alembic/versions/
# NEVER edit existing migration files — always add new ones

# 3. Test locally
make migrate

# 4. Commit and push — Railway runs migrations automatically on next deploy
git add alembic/versions/
git commit -m "migration: add notification preferences table"
git push origin main
railway up --detach

# 5. Verify in Neon SQL Editor
SELECT version_num FROM alembic_version;
```

### Add a New Env Var to Railway

```bash
# Via CLI
railway variables --set "NEW_VAR=value"

# Or via Railway Dashboard → Service → Variables → Add Variable
```

---

## Cost Summary

| Service | Plan | Monthly Cost | Free Limits |
|---------|------|-------------|-------------|
| Railway | Hobby | ~$3–5 | $5 credit/month |
| Vercel | Hobby | $0 | 100GB bandwidth |
| Neon | Free | $0 | 190 compute hrs, 512MB |
| Upstash | Free | $0 | 10k commands/day |
| Cloudflare R2 | Free | $0 | 10GB, 1M writes |
| Cloudflare | Free | $0 | Unlimited DNS/CDN |
| **Total** | | **~$3–5/month** | |

**When to upgrade:**
- **Railway → Pro ($20/mo)**: When deploys take >5 min or you need persistent volumes
- **Vercel → Pro ($20/mo)**: When bandwidth exceeds 100GB/month (i.e., ~100k active users/month)
- **Neon → Launch ($19/mo)**: When monthly compute hours exceed 190 (check dashboard)
- **Upstash → Pay-as-you-go**: When daily Redis commands exceed 10,000

---

## Weekly Monitoring Checklist

Run these checks every week:

```bash
# 1. Backend health
curl https://api.healallindia.com/health
# Expected: {"status":"healthy","version":"0.1.0"}

# 2. Railway logs — any errors?
cd ~/Desktop/HealAll && railway logs --tail 200 | grep -i error

# 3. Check Railway spend
# Railway Dashboard → Project → Usage → Current Period
```

Also check in browsers:
- [ ] Neon Dashboard → Monitoring → any query latency spikes
- [ ] Upstash → Daily Commands → trending toward 10k limit?
- [ ] Vercel → Usage → bandwidth used this month
- [ ] Cloudflare → Analytics → any traffic anomalies or blocked attacks
- [ ] R2 → Metrics → storage growth rate reasonable?

---

## Troubleshooting

### Backend returns 502 / not reachable

```bash
railway logs --tail 50        # check for crash
railway status                # check service is running
curl https://api.healallindia.com/health
```

Common causes:
- **OOM crash**: Check Railway metrics for RAM spike. Restart with `railway up --detach`
- **Migration failure**: Look for `alembic upgrade head` error in logs. Check Neon SQL editor for partial state.
- **Env var missing**: `railway variables` — verify all required vars present

### Frontend shows blank page or 500

```bash
cd frontend && vercel logs     # check serverless function logs
```

Common causes:
- **NEXT_PUBLIC_API_BASE_URL wrong**: Check Vercel → Project → Settings → Environment Variables
- **Build failed**: Check Vercel → Deployments → failed build → Build Logs

### Cloudflare 525 (SSL Handshake Failed) on api.healallindia.com

The `api` CNAME must be **DNS-only** (grey cloud), not proxied. Cloudflare → DNS → edit `api` CNAME → toggle proxy off.

### Database connection errors

```bash
# Check Neon is not suspended
# Open https://console.neon.tech → branch main → should show "Active"
# First request after idle takes ~500ms — this is normal

# Verify DATABASE_URL format (asyncpg, not psycopg2)
railway variables | grep DATABASE_URL
# Should start with: postgresql+asyncpg://
```

### "relation does not exist" errors

Migrations not applied. Run:
```bash
railway up --detach           # triggers start.sh → alembic upgrade head
# Then verify:
# Neon SQL Editor: SELECT version_num FROM alembic_version;
```

---

## Environment Variables Reference

All set in Railway → Service → Variables.

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL (asyncpg) | `postgresql+asyncpg://user:pass@host/db?sslmode=require` |
| `REDIS_URL` | Upstash Redis (TLS) | `rediss://default:pass@host:6379` |
| `JWT_SECRET_KEY` | JWT signing key (64-char hex) | `e285c5c8...` |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `15` |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `30` |
| `APP_SECRET_KEY` | App secret (64-char hex) | `02f5726b...` |
| `APP_ENV` | Environment | `production` |
| `APP_DEBUG` | Debug mode | `false` |
| `APP_ALLOWED_ORIGINS` | CORS origins (comma-separated) | `https://healallindia.com,...` |
| `S3_ENDPOINT_URL` | Cloudflare R2 endpoint | `https://ACCOUNT.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` | R2 access key | `d9b2f3...` |
| `S3_SECRET_KEY` | R2 secret key | `8f9b4f...` |
| `S3_BUCKET_MEDIA` | Media bucket name | `healall-media` |
| `S3_BUCKET_IDENTITY` | Identity bucket name | `healall-identity-ephemeral` |
| `SMS_PROVIDER` | SMS provider | `stub` (→ `msg91` when wired) |
| `EMAIL_PROVIDER` | Email provider | `stub` (→ `smtp` when wired) |
| `EMAIL_FROM` | From address | `noreply@healallindia.com` |
| `SENTRY_DSN` | Sentry project DSN | *(optional)* |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456789.apps.googleusercontent.com` |
| `RESEND_API_KEY` | Resend email API key | `re_...` |
| `SMTP_FROM_EMAIL` | Sender email address | `noreply@healallindia.com` |
| `SMTP_FROM_NAME` | Sender display name | `HealAll` |
| `MSG91_API_KEY` | MSG91 SMS key | *(optional — WhatsApp preferred)* |
| `WHATSAPP_TOKEN` | Meta Cloud API token | *(optional)* |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID | *(optional)* |
| `WHATSAPP_OTP_TEMPLATE_NAME` | Approved OTP template | `healall_otp` |
| `METRICS_ENABLED` | Expose `/metrics` endpoint | `true` |

**Vercel env vars** (set in Vercel dashboard → Project → Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.healallindia.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID |

---

## Google OAuth Setup

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID → Web application
3. Authorised JavaScript origins: `https://healallindia.com`
4. Authorised redirect URIs: `https://healallindia.com` (no redirect needed for popup flow)
5. Copy the **Client ID**
6. Set in Railway: `railway variables --set "GOOGLE_CLIENT_ID=<id>"`
7. Set in Vercel: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<id>` for production + preview

---

## Metrics

`GET /metrics` is exposed by FastAPI via `prometheus-fastapi-instrumentator`.

To disable in production: `railway variables --set "METRICS_ENABLED=false"`

For local monitoring: `cd backend && make monitoring` starts Prometheus (:9090) and Grafana (:3001).

---

*Last updated: 2026-05-01 — HealAll v0.2.0 (Google OAuth, Prometheus metrics, admin dashboard)*
