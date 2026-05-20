# Environment Variable Reference

Complete reference of all environment variables needed for the free-tier cloud deployment.

---

## Frontend (Vercel)

| Variable | Required | Value | Description |
|----------|----------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | `https://healall-api.onrender.com` | Backend API base URL (no trailing slash) |

---

## Backend (Render)

### App Configuration

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `APP_ENV` | ✅ | `production` | Environment mode |
| `APP_DEBUG` | ✅ | `false` | Disables debug endpoints (`/docs`, `/redoc`) |
| `APP_SECRET_KEY` | ✅ | `openssl rand -hex 32` | Application secret key |
| `APP_ALLOWED_ORIGINS` | ✅ | `https://healall.vercel.app` | Comma-separated CORS origins |

### Database (Neon)

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://<USER>:<PASS>@<HOST>/healall_db?sslmode=require` | Full async connection string |
| `POSTGRES_USER` | ❌ | _(only for docker-compose)_ | Not needed on Render |
| `POSTGRES_PASSWORD` | ❌ | _(only for docker-compose)_ | Not needed on Render |
| `POSTGRES_DB` | ❌ | _(only for docker-compose)_ | Not needed on Render |

### Redis / Celery (Upstash)

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `REDIS_URL` | ✅ | `redis://default:<PASS>@<HOST>:<PORT>` | Upstash Redis connection URL |

### JWT Authentication

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `JWT_SECRET_KEY` | ✅ | `openssl rand -hex 32` | JWT signing secret |
| `JWT_ALGORITHM` | ❌ | `HS256` | Default is fine |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | `15` | Access token TTL |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | ❌ | `30` | Refresh token TTL |

### Object Storage (Cloudflare R2)

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `S3_ENDPOINT_URL` | ✅ | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | R2 S3-compatible endpoint |
| `S3_ACCESS_KEY` | ✅ | _(from R2 API token)_ | R2 access key ID |
| `S3_SECRET_KEY` | ✅ | _(from R2 API token)_ | R2 secret access key |
| `S3_BUCKET_MEDIA` | ✅ | `healall-media` | Media uploads bucket |
| `S3_BUCKET_IDENTITY` | ❌ | `healall-identity-ephemeral` | Identity documents bucket |
| `S3_REGION` | ❌ | `auto` | R2 uses `auto` as its region |

### SMS & Email (Stubbed for Testing)

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `SMS_PROVIDER` | ❌ | `stub` | Keep stubbed for testing |
| `SMS_API_KEY` | ❌ | _(empty)_ | Not needed when stubbed |
| `SMS_SENDER_ID` | ❌ | `HEALAL` | SMS sender ID |
| `EMAIL_PROVIDER` | ❌ | `stub` | Keep stubbed for testing |
| `EMAIL_SMTP_HOST` | ❌ | _(empty)_ | Not needed when stubbed |
| `EMAIL_SMTP_PORT` | ❌ | `587` | Default SMTP port |
| `EMAIL_SMTP_USER` | ❌ | _(empty)_ | Not needed when stubbed |
| `EMAIL_SMTP_PASSWORD` | ❌ | _(empty)_ | Not needed when stubbed |
| `EMAIL_FROM` | ❌ | `noreply@healall.in` | Sender email address |

### Aadhaar Verification (Stubbed)

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `AADHAAR_PROVIDER` | ❌ | `stub` | Keep stubbed for testing |
| `AADHAAR_API_KEY` | ❌ | _(empty)_ | Not needed when stubbed |
| `AADHAAR_API_URL` | ❌ | _(empty)_ | Not needed when stubbed |

### Observability

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `SENTRY_DSN` | ❌ | _(empty or your DSN)_ | Sentry error tracking (free tier available) |

---

## Generating Secrets

Run these commands locally to generate secure random secrets:

```bash
# Generate APP_SECRET_KEY
openssl rand -hex 32

# Generate JWT_SECRET_KEY (use a DIFFERENT value)
openssl rand -hex 32
```

> [!CAUTION]
> **Never reuse** `APP_SECRET_KEY` and `JWT_SECRET_KEY`. Always generate separate values for each.

---

## Local vs Production Mapping

| Local (docker-compose) | Production Provider | Notes |
|------------------------|-------------------|-------|
| `localhost:5432` (Postgres container) | Neon | Connection string changes completely |
| `localhost:6379` (Redis container) | Upstash | URL format changes |
| `localhost:9000` (MinIO container) | Cloudflare R2 | Endpoint + credentials change |
| `localhost:8000` (uvicorn) | Render | Auto-assigned URL |
| `localhost:3000` (next dev) | Vercel | Auto-assigned URL |

---

## `.env.production` Template

Save this as `backend/.env.production` for reference (do **not** commit it):

```env
# ── App ──────────────────────────────────────
APP_ENV=production
APP_DEBUG=false
APP_SECRET_KEY=CHANGE_ME
APP_ALLOWED_ORIGINS=https://healall.vercel.app

# ── Database (Neon) ──────────────────────────
DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST/healall_db?sslmode=require

# ── Redis (Upstash) ──────────────────────────
REDIS_URL=redis://default:PASS@HOST:PORT

# ── JWT ──────────────────────────────────────
JWT_SECRET_KEY=CHANGE_ME
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# ── Storage (Cloudflare R2) ──────────────────
S3_ENDPOINT_URL=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY=CHANGE_ME
S3_SECRET_KEY=CHANGE_ME
S3_BUCKET_MEDIA=healall-media
S3_BUCKET_IDENTITY=healall-identity-ephemeral
S3_REGION=auto

# ── SMS / Email (stubbed) ───────────────────
SMS_PROVIDER=stub
EMAIL_PROVIDER=stub
EMAIL_FROM=noreply@healall.in

# ── Observability ────────────────────────────
SENTRY_DSN=
```
