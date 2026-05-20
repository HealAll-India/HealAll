# Step 4 — Backend on Render

Deploy the FastAPI backend as a free Web Service on Render.

---

## 4.1 Create a Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Select your **HealAll** repository
5. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `healall-api` |
| **Region** | Choose closest to your Neon database region |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | **Free** |

> [!IMPORTANT]
> The **Root Directory** must be set to `backend`. This tells Render to look for your `requirements.txt` and app code inside the `backend/` subfolder.

---

## 4.2 Add Environment Variables

On the service configuration page, scroll to **"Environment Variables"** and add each variable from the table below.

Use the values you collected from Steps 2 and 3:

```env
# App
APP_ENV=production
APP_DEBUG=false
APP_SECRET_KEY=<generate with: openssl rand -hex 32>
APP_ALLOWED_ORIGINS=https://healall.vercel.app

# Database (from Neon — Step 2)
DATABASE_URL=postgresql+asyncpg://<NEON_USER>:<NEON_PASSWORD>@<NEON_HOST>/healall_db?sslmode=require

# Redis (from Upstash — Step 2)
REDIS_URL=redis://default:<UPSTASH_PASSWORD>@<UPSTASH_HOST>:<UPSTASH_PORT>

# JWT
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# S3 / Cloudflare R2 (from Step 3)
S3_ENDPOINT_URL=https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<R2_ACCESS_KEY_ID>
S3_SECRET_KEY=<R2_SECRET_ACCESS_KEY>
S3_BUCKET_MEDIA=healall-media
S3_BUCKET_IDENTITY=healall-identity-ephemeral
S3_REGION=auto

# SMS & Email (keep stubbed for testing)
SMS_PROVIDER=stub
EMAIL_PROVIDER=stub
EMAIL_FROM=noreply@healall.in

# Sentry (optional)
SENTRY_DSN=
```

> [!TIP]
> Generate secure secrets locally:
> ```bash
> openssl rand -hex 32
> ```
> Run this twice — once for `APP_SECRET_KEY` and once for `JWT_SECRET_KEY`.

---

## 4.3 Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Run the build command (`pip install -r requirements.txt`)
   - Start the server (`uvicorn app.main:app ...`)
3. Wait for the build to complete (typically 2–4 minutes)

### Verify the Deployment

Once deployed, Render gives you a URL like:
```
https://healall-api.onrender.com
```

Test the health endpoint:

```bash
curl https://healall-api.onrender.com/health
```

Expected response:
```json
{"status": "healthy", "version": "0.1.0"}
```

> [!NOTE]
> The first request after the service sleeps (15 min of inactivity) may take 30–50 seconds. Subsequent requests are fast.

---

## 4.4 Run Database Migrations

After the backend is deployed and running, run Alembic migrations:

### Option A: From Render Shell

1. In Render dashboard, go to your `healall-api` service
2. Click the **"Shell"** tab
3. Run:

```bash
alembic upgrade head
```

### Option B: From Your Local Machine

```bash
cd ~/Desktop/HealAll/backend

# Point to your Neon database
export DATABASE_URL="postgresql+asyncpg://<NEON_USER>:<NEON_PASSWORD>@<NEON_HOST>/healall_db?sslmode=require"

# Run migrations
alembic upgrade head
```

---

## 4.5 (Optional) Deploy Celery Worker

If your app requires background tasks (Celery), you'll need a separate Render service:

1. Click **"New +"** → **"Background Worker"**
2. Connect the same GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `healall-worker` |
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `celery -A app.worker.celery_app worker --loglevel=info --concurrency=2` |
| **Instance Type** | **Free** |

4. Add the **same environment variables** as the web service
5. Click **Create**

> [!WARNING]
> Render's free tier allows **one free web service** and **one free background worker**. If you've already used your free slots, the Celery worker will require a paid plan ($7/month). For testing, you can skip the worker if background tasks aren't critical.

---

## 4.6 Update CORS After Frontend Deploy

After you deploy the frontend (Step 5), come back and update:

```
APP_ALLOWED_ORIGINS=https://your-actual-vercel-url.vercel.app
```

You can add multiple origins separated by commas if needed.

---

## 4.7 Troubleshooting

### Build fails with `libpq-dev` error

Render's Python runtime includes `libpq` by default. If you still get errors, switch to **Docker** deployment:

1. Change the build settings:
   - **Environment:** Docker
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Context:** `./`

### `asyncpg` connection errors

- Verify the `DATABASE_URL` starts with `postgresql+asyncpg://`
- Ensure `?sslmode=require` is appended
- Check that your Neon database is awake (it auto-suspends after 5 min of no connections)

### Redis connection refused

- Ensure `REDIS_URL` uses the correct protocol (`redis://` or `rediss://`)
- Check Upstash dashboard for the correct host and port

---

## ✅ Checklist

- [ ] Render web service created with correct root directory (`backend`)
- [ ] All environment variables added
- [ ] Build and deploy succeeded
- [ ] `/health` endpoint returns `{"status": "healthy"}`
- [ ] Database migrations run successfully
- [ ] (Optional) Celery background worker deployed
- [ ] Note down your Render URL: `https://healall-api.onrender.com`

**Next:** [Step 5 — Frontend on Vercel →](./05-frontend.md)
