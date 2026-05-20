# Step 5 — Frontend on Vercel

Deploy the Next.js frontend to Vercel. This is the easiest step — Vercel auto-detects Next.js and handles everything.

---

## 5.1 Connect Your Repository

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Select **"Import Git Repository"**
4. Find and select your **HealAll** repository
5. Vercel auto-detects it as a monorepo — configure as follows:

| Setting | Value |
|---------|-------|
| **Project Name** | `healall` |
| **Framework Preset** | Next.js _(auto-detected)_ |
| **Root Directory** | `frontend` |
| **Build Command** | `next build` _(default, leave as-is)_ |
| **Output Directory** | _(leave blank — Next.js default)_ |
| **Install Command** | `npm install` _(default)_ |

> [!IMPORTANT]
> Click **"Edit"** next to Root Directory and set it to `frontend`. This is critical — without it, Vercel will try to build from the repo root and fail.

---

## 5.2 Add Environment Variables

In the **"Environment Variables"** section, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://healall-api.onrender.com` |

Replace the URL with your actual Render backend URL from Step 4.

> [!NOTE]
> Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. This is intentional — the frontend needs to know where the API is.

---

## 5.3 Deploy

1. Click **"Deploy"**
2. Vercel will:
   - Install dependencies (`npm install` inside `frontend/`)
   - Build the Next.js app (`next build`)
   - Deploy to Vercel's edge network
3. Build typically takes 1–2 minutes

### Your Live URL

After deployment, Vercel assigns a URL:
```
https://healall.vercel.app
```

Or a random one like:
```
https://healall-abc123.vercel.app
```

---

## 5.4 Update the Backend CORS

Now that you have your Vercel URL, go back to Render and update the backend's CORS setting:

1. Open your `healall-api` service on Render
2. Go to **Environment** → find `APP_ALLOWED_ORIGINS`
3. Update it to your Vercel URL:

```
APP_ALLOWED_ORIGINS=https://healall.vercel.app
```

For multiple origins (e.g., including localhost for local dev):
```
APP_ALLOWED_ORIGINS=https://healall.vercel.app,http://localhost:3000
```

4. Click **Save Changes** — Render will auto-redeploy

---

## 5.5 Verify End-to-End

1. Open your Vercel URL in a browser
2. The frontend should load
3. Try an action that calls the API (e.g., sign up, login)
4. Check the browser DevTools **Network** tab to confirm API calls go to your Render URL

### Common Issues

#### API calls fail with CORS errors
- Double-check `APP_ALLOWED_ORIGINS` on Render matches your Vercel URL exactly (including `https://`)
- Ensure no trailing slash in the origin

#### API calls fail with `net::ERR_CONNECTION_REFUSED`
- Your Render backend may be sleeping. Wait 30–50 seconds and retry
- Verify `NEXT_PUBLIC_API_BASE_URL` doesn't have a trailing slash

#### Build fails on Vercel
- Ensure `Root Directory` is set to `frontend`
- Check that `package.json` is present in the `frontend/` folder
- Look at the Vercel build logs for specific TypeScript or ESLint errors

---

## 5.6 Automatic Deployments

By default, Vercel auto-deploys on every push to `main`:

- Push to `main` → production deploy
- Open a Pull Request → preview deploy (unique URL per PR)

You can configure this under **Project Settings** → **Git**.

---

## 5.7 Custom Domain (Optional)

If you own a domain, you can add it for free:

1. Go to **Project Settings** → **Domains**
2. Add your domain (e.g., `app.healall.in`)
3. Update your DNS records as Vercel instructs
4. Update `APP_ALLOWED_ORIGINS` on Render to include the custom domain

---

## ✅ Checklist

- [ ] Vercel project created with root directory set to `frontend`
- [ ] `NEXT_PUBLIC_API_BASE_URL` environment variable set to Render URL
- [ ] Build and deploy succeeded
- [ ] Vercel URL opens in browser and loads the app
- [ ] Backend `APP_ALLOWED_ORIGINS` updated to include the Vercel URL
- [ ] End-to-end flow tested (frontend → backend API call works)

**Next:** [Environment Variable Reference →](./06-environment-variables.md)
