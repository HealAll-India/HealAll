# HealAll AWS infrastructure

CloudFormation stack provisioning S3 storage + IAM identities for HealAll.

## What this creates

| Resource                              | Purpose                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `healall-media-prod` bucket           | Public-read, signed-write. Profile photos + post attachments.                |
| `healall-identity-ephemeral-prod`     | Private. 30-day lifecycle expiry. Identity documents (Aadhaar).              |
| `healall-app-prod` IAM user           | Long-lived access key the backend uses to mint presigned URLs.               |
| `healall-deploy-prod` IAM role        | OIDC-trusted role GitHub Actions assumes to update this stack.               |
| GitHub OIDC provider                  | Trust anchor so CI can assume `healall-deploy-prod` without long-lived keys. |

Region: `ap-south-1` (Mumbai).

## One-time bootstrap (you run this, locally)

You already have root credentials (`aws sts get-caller-identity` shows `693139803489`). Run:

```bash
cd /Users/anupam8nith/Desktop/HealAll
./infra/aws/cloudformation/deploy.sh
```

That deploys the stack. At the end it prints the outputs table — keep this open.

## Wire up the credentials

The script doesn't generate access keys for the app IAM user (CloudFormation can but the keys would leak through stack outputs). Do this manually:

1. **AWS Console → IAM → Users → `healall-app-prod` → Security credentials → Create access key**
   - Use case: "Application running outside AWS"
   - Save the **Access key ID** + **Secret access key**.
2. **Railway → Backend service → Variables → add** (names match `backend/app/core/config.py`):
   - `S3_ACCESS_KEY` = from step 1
   - `S3_SECRET_KEY` = from step 1
   - `S3_REGION` = `ap-south-1`
   - `S3_ENDPOINT_URL` = `https://s3.ap-south-1.amazonaws.com`
   - `S3_BUCKET_MEDIA` = `healall-media-prod`
   - `S3_BUCKET_IDENTITY` = `healall-identity-ephemeral-prod`
3. **GitHub → repo Settings → Secrets and variables → Actions → Variables tab → New repository variable:**
   - Name: `AWS_DEPLOY_ROLE_ARN`
   - Value: from the `DeployRoleArn` stack output (looks like `arn:aws:iam::693139803489:role/healall-deploy-prod`)

   Use a **Variable**, not a Secret — the role ARN isn't secret and Variables are easier to reference.

## How CI keeps it in sync

`.github/workflows/aws-infra.yml` runs on every push to `main` that touches `infra/aws/cloudformation/`. It uses OIDC to assume `healall-deploy-prod` (no AWS keys stored in GitHub) and runs `cloudformation deploy`.

To trigger manually: GitHub → Actions → `aws-infra` → Run workflow.

## Updating the stack

Edit `healall-media.yml`, open a PR, merge to `main`. CI deploys the change. For local iteration:

```bash
ENVIRONMENT=dev ./infra/aws/cloudformation/deploy.sh
```

Creates a parallel `healall-media-dev` stack with `*-dev` buckets, so you can experiment without touching prod.

## Tearing down (don't)

The buckets have `DeletionPolicy: Retain` so even `aws cloudformation delete-stack` won't remove uploaded files. To fully drop the stack:

1. Empty the buckets (`aws s3 rm s3://healall-media-prod --recursive`).
2. Delete the buckets manually in the console.
3. `aws cloudformation delete-stack --stack-name healall-media-prod`.

Then re-deploy from scratch.
