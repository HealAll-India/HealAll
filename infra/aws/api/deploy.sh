#!/usr/bin/env bash
#
# Deploy the HealAll API to AWS Lambda (healall-api.yml). Run it again to ship
# a new version: it builds the image, runs migrations, then updates the stack.
#
# Prerequisites:
#   * AWS CLI v2 signed in to the HealAll account (`aws sts get-caller-identity`).
#   * Docker with buildx running.
#   * First run: cp infra/aws/api/.env.example infra/aws/api/.env.prod, fill it in.
#
# Usage:
#   ./infra/aws/api/deploy.sh                     # build, push, migrate, deploy
#   SKIP_MIGRATIONS=1 ./infra/aws/api/deploy.sh   # schema unchanged
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-prod}"
REGION="${AWS_REGION:-ap-south-1}"
DOMAIN="${API_DOMAIN:-api.healallindia.com}"
STACK_NAME="healall-api-${ENVIRONMENT}"
REPO_NAME="healall-api"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${HERE}/../../.." && pwd)"
ENV_FILE="${ENV_FILE:-${HERE}/.env.${ENVIRONMENT}}"

[ -f "${ENV_FILE}" ] || { echo "Missing ${ENV_FILE}: copy .env.example to it and fill it in." >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a
for name in APP_SECRET_KEY JWT_SECRET_KEY DATABASE_URL REDIS_URL S3_ACCESS_KEY S3_SECRET_KEY RESEND_API_KEY; do
  [ -n "${!name:-}" ] || { echo "${name} is empty in ${ENV_FILE}" >&2; exit 1; }
done

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
echo "==> AWS account ${ACCOUNT}, region ${REGION}, stack ${STACK_NAME}"

# 1. Image -------------------------------------------------------------------
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
if ! aws ecr describe-repositories --region "${REGION}" --repository-names "${REPO_NAME}" >/dev/null 2>&1; then
  echo "==> Creating ECR repository ${REPO_NAME}"
  aws ecr create-repository --region "${REGION}" --repository-name "${REPO_NAME}" \
    --image-scanning-configuration scanOnPush=true >/dev/null
  aws ecr put-lifecycle-policy --region "${REGION}" --repository-name "${REPO_NAME}" \
    --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep the last 5 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}' >/dev/null
fi
TAG="$(git -C "${ROOT}" rev-parse --short HEAD)"
git -C "${ROOT}" diff --quiet HEAD -- backend || TAG="${TAG}-dirty-$(date +%s)"
IMAGE="${REGISTRY}/${REPO_NAME}:${TAG}"
echo "==> Building and pushing ${IMAGE}"
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${REGISTRY}" >/dev/null
# --provenance=false: Lambda rejects the multi-manifest index buildx adds otherwise.
docker buildx build --platform linux/amd64 --provenance=false \
  -f "${ROOT}/backend/Dockerfile.lambda" -t "${IMAGE}" --push "${ROOT}/backend"

# 2. Migrations: once per deploy, never on a Lambda cold start ----------------
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "==> Running migrations"
  docker run --rm --platform linux/amd64 -e DATABASE_URL -e APP_SECRET_KEY -e JWT_SECRET_KEY \
    "${IMAGE}" alembic upgrade head
fi

# 3. TLS certificate for the custom domain ------------------------------------
CERT_ARN="$(aws acm list-certificates --region "${REGION}" \
  --certificate-statuses ISSUED PENDING_VALIDATION \
  --query "CertificateSummaryList[?DomainName=='${DOMAIN}'].CertificateArn | [0]" --output text)"
if [ -z "${CERT_ARN}" ] || [ "${CERT_ARN}" = "None" ]; then
  echo "==> Requesting a certificate for ${DOMAIN}"
  CERT_ARN="$(aws acm request-certificate --region "${REGION}" --domain-name "${DOMAIN}" \
    --validation-method DNS --query CertificateArn --output text)"
  sleep 10
fi
if [ "$(aws acm describe-certificate --region "${REGION}" --certificate-arn "${CERT_ARN}" \
  --query Certificate.Status --output text)" != "ISSUED" ]; then
  echo
  echo "==> Add this CNAME in Cloudflare (DNS only, grey cloud). Waiting for it to validate..."
  aws acm describe-certificate --region "${REGION}" --certificate-arn "${CERT_ARN}" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord.[Name,Value]' --output table
  aws acm wait certificate-validated --region "${REGION}" --certificate-arn "${CERT_ARN}"
fi

# 4. Stack --------------------------------------------------------------------
echo "==> Deploying ${STACK_NAME}"
PARAMS=(
  "Environment=${ENVIRONMENT}"
  "ImageUri=${IMAGE}"
  "ApiDomainName=${DOMAIN}"
  "CertificateArn=${CERT_ARN}"
  "AppSecretKey=${APP_SECRET_KEY}"
  "JwtSecretKey=${JWT_SECRET_KEY}"
  "DatabaseUrl=${DATABASE_URL}"
  "RedisUrl=${REDIS_URL}"
  "S3AccessKey=${S3_ACCESS_KEY}"
  "S3SecretKey=${S3_SECRET_KEY}"
  "ResendApiKey=${RESEND_API_KEY}"
  "Msg91ApiKey=${MSG91_API_KEY:-}"
  "Msg91TemplateIdOtp=${MSG91_TEMPLATE_ID_OTP:-}"
  "GoogleClientId=${GOOGLE_CLIENT_ID:-}"
  "AllowedOriginRegex=${APP_ALLOWED_ORIGIN_REGEX:-}"
  "SentryDsn=${SENTRY_DSN:-}"
  "AiTriageEnabled=${AI_TRIAGE_ENABLED:-false}"
  "GroqApiKey=${GROQ_API_KEY:-}"
  "GeminiApiKey=${GEMINI_API_KEY:-}"
)
aws cloudformation deploy --region "${REGION}" --stack-name "${STACK_NAME}" \
  --template-file "${HERE}/healall-api.yml" --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset --parameter-overrides "${PARAMS[@]}"

# 5. Smoke test ---------------------------------------------------------------
output() {
  aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
ENDPOINT="$(output DefaultEndpoint)"
TARGET="$(output DnsTarget)"
echo "==> ${ENDPOINT}/health (the first call includes a cold start)"
curl -fsS --max-time 30 "${ENDPOINT}/health"
echo
echo
echo "Done. In Cloudflare, point the 'api' record at:"
echo "    CNAME api -> ${TARGET}   (proxied is fine)"
echo "and keep SSL/TLS on Full or Full (strict), never Flexible."
