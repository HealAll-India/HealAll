# Step 3 — Object Storage (Cloudflare R2)

Your app uses MinIO locally as an S3-compatible object store. In production, Cloudflare R2 is the best free replacement — it's fully S3-compatible, and the free tier is generous (10 GB storage, 10M reads/month).

---

## 3.1 Create a Cloudflare R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. In the left sidebar, click **R2 Object Storage**
3. If this is your first time, click **"Activate R2"** (no charge — the free tier is automatic)
4. Click **"Create bucket"**
5. Configure:
   - **Bucket name:** `healall-media`
   - **Location hint:** Choose closest region (e.g., `APAC`)
6. Click **Create bucket**

### (Optional) Create a second bucket for identity documents

If your app uses separate buckets for media and ephemeral identity docs:

- Create another bucket named **`healall-identity-ephemeral`**

---

## 3.2 Generate S3 API Credentials

1. Go to **R2 Overview** → click **"Manage R2 API Tokens"** (top right)
2. Click **"Create API Token"**
3. Configure:
   - **Token name:** `healall-backend`
   - **Permissions:** **Object Read & Write**
   - **Bucket scope:** Apply to specific buckets → select `healall-media` (and `healall-identity-ephemeral` if created)
   - **TTL:** No expiration (for testing)
4. Click **Create API Token**

### Copy Your Credentials

After creation, you'll see:

| Field | Maps to Env Variable |
|-------|---------------------|
| **Access Key ID** | `S3_ACCESS_KEY` |
| **Secret Access Key** | `S3_SECRET_KEY` |

> [!CAUTION]
> The **Secret Access Key** is shown only once. Copy it immediately and store it securely.

### Get the S3 Endpoint URL

Your R2 S3-compatible endpoint is:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Find your **Account ID** on the R2 overview page or in the Cloudflare dashboard URL:
`https://dash.cloudflare.com/<ACCOUNT_ID>/r2`

---

## 3.3 Configure CORS (Required for Direct Uploads)

If your frontend ever uploads files directly to R2, set up CORS:

1. Open your `healall-media` bucket
2. Go to **Settings** → **CORS Policy**
3. Add a rule:

```json
[
  {
    "AllowedOrigins": ["https://healall.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

> [!NOTE]
> Replace `https://healall.vercel.app` with your actual Vercel URL once you have it.

---

## 3.4 Save These Values

| Env Variable | Value | Example |
|---|---|---|
| `S3_ENDPOINT_URL` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | `https://a1b2c3.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` | From API token | `e4f5a6b7...` |
| `S3_SECRET_KEY` | From API token | `c8d9e0f1...` |
| `S3_BUCKET_MEDIA` | `healall-media` | `healall-media` |
| `S3_BUCKET_IDENTITY` | `healall-identity-ephemeral` | `healall-identity-ephemeral` |
| `S3_REGION` | `auto` | `auto` |

> [!TIP]
> Cloudflare R2 uses `auto` as the region. Your existing `us-east-1` will also work, but `auto` is the canonical value.

---

## ✅ Checklist

- [ ] R2 activated on your Cloudflare account
- [ ] `healall-media` bucket created
- [ ] (Optional) `healall-identity-ephemeral` bucket created
- [ ] S3 API token created with Read & Write permissions
- [ ] `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_ENDPOINT_URL` saved
- [ ] CORS configured on the bucket

**Next:** [Step 4 — Backend on Render →](./04-backend.md)
