# Step 1 — Prerequisites

Before deploying, you need two things: a GitHub repository and free accounts on the hosting providers.

---

## 1.1 Push Your Code to GitHub

If your project isn't already on GitHub, create a repository:

1. Go to [github.com/new](https://github.com/new)
2. Create a **private** repository named `HealAll`
3. Push your local code:

```bash
cd ~/Desktop/HealAll

# If git isn't initialized yet:
git init
git add .
git commit -m "Initial commit"

# Add your remote and push:
git remote add origin https://github.com/<YOUR_USERNAME>/HealAll.git
git branch -M main
git push -u origin main
```

> [!IMPORTANT]
> Make sure `.env` files are listed in `.gitignore` before pushing. Your project already ignores them in `backend/.gitignore`, but double-check that no secrets are committed.

### Verify `.gitignore` coverage

Your backend `.gitignore` should contain at least:

```gitignore
.env
.venv/
__pycache__/
*.pyc
```

Your frontend `.gitignore` should contain:

```gitignore
.env.local
node_modules/
.next/
```

---

## 1.2 Create Free Accounts

Sign up at each of the following services. All offer free tiers with **no credit card required** (except Cloudflare, which may ask but won't charge).

| Service | URL | What For |
|---------|-----|----------|
| **GitHub** | [github.com](https://github.com) | Source code hosting (you likely already have this) |
| **Neon** | [neon.tech](https://neon.tech) | Managed PostgreSQL database |
| **Upstash** | [upstash.com](https://upstash.com) | Serverless Redis |
| **Cloudflare** | [dash.cloudflare.com](https://dash.cloudflare.com) | R2 object storage (S3-compatible) |
| **Render** | [render.com](https://render.com) | Backend API hosting |
| **Vercel** | [vercel.com](https://vercel.com) | Frontend hosting |

> [!TIP]
> Sign up for **Render** and **Vercel** using your **GitHub account** — this makes connecting repositories seamless later.

---

## 1.3 Tools You'll Need Locally

You'll mostly work through web dashboards, but having these CLI tools is helpful for debugging:

```bash
# Vercel CLI (optional — for manual deploys)
npm i -g vercel

# Render CLI (optional)
# Not required — Render deploys from GitHub automatically

# Neon CLI (optional — for running migrations)
npm i -g neonctl
```

---

## ✅ Checklist

- [ ] Code is pushed to a GitHub repository
- [ ] No secrets are committed (`.env` files are gitignored)
- [ ] Accounts created on: Neon, Upstash, Cloudflare, Render, Vercel
- [ ] (Optional) Vercel CLI installed locally

**Next:** [Step 2 — Database & Redis →](./02-database-redis.md)
