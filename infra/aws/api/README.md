# HealAll API on AWS Lambda

`api.healallindia.com` runs as one Lambda function behind an API Gateway HTTP
API. Nothing runs while nobody uses the app: it scales to zero and wakes on
the next request.

```
Cloudflare (DNS + proxy) -> API Gateway HTTP API (custom domain, TLS via ACM)
  -> Lambda (container image: backend/Dockerfile.lambda + Lambda Web Adapter)
  -> Neon Postgres, Upstash Redis, S3 (unchanged)
```

## Deploy

```bash
cp infra/aws/api/.env.example infra/aws/api/.env.prod   # once; fill it in, never commit it
./infra/aws/api/deploy.sh
```

`deploy.sh` builds and pushes the image to ECR, runs `alembic upgrade head`
from that image, requests the ACM certificate (first run: it prints a CNAME to
add in Cloudflare and waits), deploys `healall-api.yml`, and calls `/health`.
Run it again to ship a new version. First run only: point the Cloudflare `api`
record at the `DnsTarget` it prints, with SSL/TLS on Full or Full (strict).

## Cost

At HealAll's traffic this is close to free: Lambda's always-free monthly
allowance (1M requests, 400,000 GB-seconds) covers it, API Gateway HTTP APIs
cost about $1 per million requests, and ECR keeps the last 5 images (a few
cents). There is no hourly charge.

## Things that differ from a long-running server

- **Cold starts.** The first request after a quiet spell waits a few seconds
  while Lambda starts the container. Later requests are fast.
- **No work after the response.** Lambda freezes the process once a response
  is returned, so OTP and welcome emails use `app.core.after_response`, which
  sends them before responding when it runs on Lambda.
- **Migrations run in `deploy.sh`,** not at start-up, so cold starts don't race
  each other on the schema.
- **Rate limits are per instance.** slowapi keeps counts in memory, and Lambda
  may run a few instances and recycle them, so limits are looser than on one
  server. Pointing slowapi at Redis would make them shared.
- **Limits.** API Gateway times out at 30 s and accepts 10 MB request bodies.
  Media uploads go straight to S3 with presigned URLs, so neither matters.
