# HealAll — Free-Tier Cloud Deployment Guide

> Deploy the full HealAll stack (Next.js frontend + FastAPI backend + Postgres + Redis + S3 storage) to the cloud for **$0/month** using generous free tiers.

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        INTERNET / USERS                         │
└────────────────┬───────────────────────────┬─────────────────────┘
                 │                           │
         ┌───────▼────────┐          ┌───────▼────────┐
         │   Vercel        │          │   Render       │
         │   (Frontend)    │────API──▶│   (Backend)    │
         │   Next.js 16    │          │   FastAPI      │
         └────────────────┘          └──┬──┬──┬───────┘
                                        │  │  │
                    ┌───────────────────┘  │  └──────────────────┐
                    │                      │                     │
            ┌───────▼────────┐     ┌──────▼───────┐     ┌───────▼────────┐
            │   Neon          │     │  Upstash      │     │  Cloudflare    │
            │   (PostgreSQL)  │     │  (Redis)      │     │  R2 (S3)       │
            │   Free 500 MB   │     │  Free 10K/day │     │  Free 10 GB    │
            └────────────────┘     └──────────────┘     └────────────────┘
```

## Services & Free-Tier Limits

| Component        | Provider         | Free Tier Limit                    | Sleeps? |
|------------------|------------------|------------------------------------|---------|
| **Frontend**     | Vercel           | Unlimited hobby projects           | No      |
| **Backend API**  | Render           | 750 hrs/month, 512 MB RAM          | Yes (15 min idle) |
| **PostgreSQL**   | Neon             | 500 MB storage, auto-suspend       | Yes (5 min idle)  |
| **Redis**        | Upstash          | 10,000 commands/day, 256 MB        | No (serverless)   |
| **Object Storage** | Cloudflare R2  | 10 GB storage, 10M reads/month     | No      |

> [!NOTE]
> **Sleep behaviour**: Render's free web services spin down after 15 minutes of no traffic. The first request after sleep takes ~30–50 seconds. This is perfectly fine for testing.

## Deployment Order

Follow the guides in this order — each step depends on the previous one:

| Step | Guide | What You Get |
|------|-------|--------------|
| 1 | [Prerequisites](./01-prerequisites.md) | Accounts created, GitHub repo ready |
| 2 | [Database & Redis](./02-database-redis.md) | `DATABASE_URL` and `REDIS_URL` |
| 3 | [Object Storage](./03-storage.md) | `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| 4 | [Backend on Render](./04-backend.md) | Live API at `https://healall-api.onrender.com` |
| 5 | [Frontend on Vercel](./05-frontend.md) | Live app at `https://healall.vercel.app` |

A complete [Environment Variable Reference](./06-environment-variables.md) is also provided.

## Time Estimate

| Step | Time |
|------|------|
| Creating all accounts | ~10 min |
| Provisioning Neon + Upstash + R2 | ~10 min |
| Deploying backend to Render | ~10 min |
| Deploying frontend to Vercel | ~5 min |
| **Total** | **~35 min** |

## Quick-Start (TL;DR)

If you're experienced with cloud deployments, here's the condensed version:

```bash
# 1. Provision managed services (sign up at each):
#    - Neon.tech       → create "healall_db", copy DATABASE_URL
#    - Upstash.com     → create Redis database, copy REDIS_URL
#    - Cloudflare R2   → create bucket "healall-media", generate S3 credentials

# 2. Deploy Backend to Render:
#    - Connect GitHub repo → Root Directory: backend
#    - Build:  pip install -r requirements.txt
#    - Start:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
#    - Add all env vars from .env.example with cloud values

# 3. Deploy Frontend to Vercel:
#    - Connect GitHub repo → Root Directory: frontend
#    - Framework: Next.js (auto-detected)
#    - Add env: NEXT_PUBLIC_API_BASE_URL=https://<your-render-url>
```
