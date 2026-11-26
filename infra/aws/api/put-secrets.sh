#!/usr/bin/env bash
#
# Put the API's secrets from .env.<env> into the Secrets Manager secret
# healall-api-<env>/app, which the bootstrap stack creates. The Lambda
# function reads that secret at start-up. Run it by hand, with an admin
# login, whenever a secret changes; CI never writes it.
#
# Usage:
#   ./infra/aws/api/put-secrets.sh
# Instances already running keep the old values until they are recycled;
# run deploy.sh afterwards to start fresh ones straight away.
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-prod}"
REGION="${AWS_REGION:-ap-south-1}"
SECRET_ID="healall-api-${ENVIRONMENT}/app"
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${ENV_FILE:-${HERE}/.env.${ENVIRONMENT}}"

[ -f "${ENV_FILE}" ] || { echo "Missing ${ENV_FILE}: copy .env.example to it and fill it in." >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

REQUIRED=(APP_SECRET_KEY JWT_SECRET_KEY DATABASE_URL REDIS_URL RESEND_API_KEY)
OPTIONAL=(MSG91_API_KEY SENTRY_DSN GROQ_API_KEY GEMINI_API_KEY VAPID_PRIVATE_KEY METRICS_TOKEN)
for name in "${REQUIRED[@]}"; do
  [ -n "${!name:-}" ] || { echo "${name} is empty in ${ENV_FILE}" >&2; exit 1; }
done

# Build the JSON in Python so quotes and & in values are escaped properly, and
# pass it on stdin so it never shows in the process list.
export SECRET_NAMES="${REQUIRED[*]} ${OPTIONAL[*]}"
python3 -c '
import json, os
names = os.environ["SECRET_NAMES"].split()
print(json.dumps({n: os.environ[n] for n in names if os.environ.get(n)}))
' | aws secretsmanager put-secret-value --region "${REGION}" --secret-id "${SECRET_ID}" \
      --secret-string file:///dev/stdin --query VersionId --output text >/dev/null

echo "==> Updated ${SECRET_ID} in ${REGION}"
