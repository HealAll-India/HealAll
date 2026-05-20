# Step 2 — Database (Neon) & Redis (Upstash)

Set up managed PostgreSQL and Redis before deploying the backend.

---

## 2.1 PostgreSQL on Neon

### Create the Database

1. Log in to [Neon Console](https://console.neon.tech)
2. Click **"Create a project"**
3. Configure:
   - **Project name:** `healall`
   - **Database name:** `healall_db`
   - **Region:** Choose the one closest to you (e.g., `Asia Pacific (Singapore)` for India)
   - **Postgres version:** 15 or 16
4. Click **Create**

### Get Your Connection String

After creation, Neon shows you a connection string. You need **two** versions:

#### For the Backend App (asyncpg)

Click the connection string dropdown and select **"Parameters only"** or build it yourself:

```
postgresql+asyncpg://<USER>:<PASSWORD>@<HOST>/<DATABASE>?sslmode=require
```

Example:
```
postgresql+asyncpg://healall_owner:abc123xyz@ep-cool-breeze-123456.ap-southeast-1.aws.neon.tech/healall_db?sslmode=require
```

> [!IMPORTANT]
> HealAll uses `asyncpg` as its database driver. The connection string **must** start with `postgresql+asyncpg://`, not `postgres://`.

#### For Alembic Migrations (one-time setup)

When running migrations, you may need a synchronous URL variant. Neon supports pooled connections — use the connection string as-is, but swap the driver:

```
postgresql+asyncpg://...   →  used by the app at runtime
postgresql://...            →  used by alembic (if needed)
```

### Save These Values

| Env Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://<USER>:<PASSWORD>@<HOST>/healall_db?sslmode=require` |
| `POSTGRES_USER` | _(from Neon dashboard, e.g. `healall_owner`)_ |
| `POSTGRES_PASSWORD` | _(from Neon dashboard)_ |
| `POSTGRES_DB` | `healall_db` |

---

## 2.2 Redis on Upstash

### Create a Redis Database

1. Log in to [Upstash Console](https://console.upstash.com)
2. Click **"Create Database"**
3. Configure:
   - **Name:** `healall-redis`
   - **Region:** Choose closest to your Neon database region
   - **Type:** Regional _(not Global, to stay on free tier)_
   - **Eviction:** Enabled (keeps memory under control)
4. Click **Create**

### Get Your Redis URL

After creation, scroll to the **"Connect"** section:

1. Select **`redis://`** format (not `rediss://` unless TLS is required — Upstash supports both)
2. Copy the full URL:

```
redis://default:<PASSWORD>@<HOST>:<PORT>
```

Example:
```
redis://default:AXk3AAIncDEz...@usw1-relative-cat-12345.upstash.io:6379
```

> [!TIP]
> Upstash uses TLS by default. If your backend Redis client requires TLS, use the `rediss://` URL (note the double `s`). The Python `redis` library supports both.

### Save These Values

| Env Variable | Value |
|---|---|
| `REDIS_URL` | `redis://default:<PASSWORD>@<HOST>:<PORT>` |

---

## 2.3 Run Database Migrations

After deploying the backend (Step 4), you'll need to run Alembic migrations against the Neon database. You can do this **locally** before deploying:

```bash
cd ~/Desktop/HealAll/backend

# Set the DATABASE_URL to your Neon connection string
export DATABASE_URL="postgresql+asyncpg://<USER>:<PASSWORD>@<HOST>/healall_db?sslmode=require"

# Run migrations
alembic upgrade head
```

> [!NOTE]
> If you get SSL errors locally, ensure your Python environment has `asyncpg` installed and your connection string includes `?sslmode=require`.

Alternatively, you can run migrations from Render's **Shell** tab after deploying the backend (covered in Step 4).

---

## ✅ Checklist

- [ ] Neon project created with `healall_db` database
- [ ] `DATABASE_URL` copied (with `postgresql+asyncpg://` prefix)
- [ ] Upstash Redis database created
- [ ] `REDIS_URL` copied
- [ ] (Optional) Migrations run locally against Neon

**Next:** [Step 3 — Object Storage →](./03-storage.md)
