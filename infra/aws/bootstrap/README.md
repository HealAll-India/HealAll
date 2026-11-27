# One-time AWS setup for API deploys from GitHub

After this, every merge to `main` that touches `backend/` deploys the API to
AWS Lambda through `.github/workflows/api-deploy.yml`. No AWS access keys are
stored anywhere: GitHub Actions gets a short-lived session from an IAM role
that only `main` of `HealAll-India/HealAll` can assume.

## 1. Run the bootstrap once (an AWS admin)

Open AWS CloudShell in **Asia Pacific (Mumbai) ap-south-1** and run:

```bash
git clone https://github.com/HealAll-India/HealAll.git
cd HealAll && ./infra/aws/bootstrap/bootstrap.sh you@example.com
```

The email gets the budget alarms. The optional second argument is the
monthly budget in USD (default 5). It creates the stack `healall-bootstrap-api`:

| Resource | Cost |
|---|---|
| GitHub OIDC provider (reused if the account already has one) | free |
| IAM role `healall-gha-api-deploy` | free |
| ECR repository `healall-api`, last 5 images kept | about $0.10 per GB-month of images |
| AWS Budgets alarm `healall-monthly` (80% actual, 100% forecast) | free |

This stack is never deployed from CI, so the deploy role cannot widen its own
permissions. What the role can do: update only the `healall-api-prod`
CloudFormation stack, push to the `healall-api` ECR repo, manage Lambda
functions, log groups and roles named `healall-api-*` (those roles may only
carry `AWSLambdaBasicExecutionRole` and the stack's own `healall-api-prod-runtime`
policy), manage HTTP APIs in ap-south-1 and the
`api.healallindia.com` custom domain, and request ACM certificates.

## 2. Add GitHub settings

`Settings > Secrets and variables > Actions`.

Variables:

| Name | Value |
|---|---|
| `AWS_API_DEPLOY_ROLE_ARN` | printed by the bootstrap |
| `API_DEPLOY_ENABLED` | `true`, only when you want deploys to start |
| `APP_ALLOWED_ORIGIN_REGEX` | optional, extra CORS origins |
| `AI_TRIAGE_ENABLED` | optional, `true` or `false` |

Secrets, only what migrations need: `APP_SECRET_KEY`, `JWT_SECRET_KEY`,
`DATABASE_URL`. Optional, not secret: `MSG91_TEMPLATE_ID_OTP`, `GOOGLE_CLIENT_ID`.

The API's own secrets (Redis, Resend, MSG91, Sentry, AI keys, the VAPID
private key, the metrics token, and the three above) go in Secrets Manager,
not GitHub. With an admin login, fill `infra/aws/api/.env.prod` and run:

```bash
./infra/aws/api/put-secrets.sh
```

Run it again whenever a secret changes. S3 needs no keys: the function uses
its own role.

## 3. First deploy

Set `API_DEPLOY_ENABLED=true`, then run **Actions > api-deploy > Run
workflow**. The first run requests the TLS certificate and stops with a CNAME
to add in Cloudflare (DNS only). Add it, wait a few minutes, run it again. It
then builds the image, runs migrations, creates the stack and calls `/health`.
Pointing `api.healallindia.com` at the new endpoint is a separate, manual
Cloudflare change (see `infra/aws/api/README.md`).

To stop all deploys, set `API_DEPLOY_ENABLED` to anything but `true`.
