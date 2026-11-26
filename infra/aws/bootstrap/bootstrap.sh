#!/usr/bin/env bash
#
# One-time AWS setup for deploying the HealAll API from GitHub Actions.
# Run it once, signed in as an admin of the HealAll AWS account. The easiest
# place is AWS CloudShell in the Mumbai region (ap-south-1), which is already
# signed in and has git and the AWS CLI:
#
#   git clone https://github.com/HealAll-India/HealAll.git
#   cd HealAll && ./infra/aws/bootstrap/bootstrap.sh you@example.com
#
# It creates (see healall-api-bootstrap.yml): the GitHub OIDC provider if the
# account has none, the IAM role healall-gha-api-deploy, the ECR repository
# healall-api and a monthly budget alarm. All free apart from ECR storage.
# It deploys nothing that serves traffic. Safe to run again to update.
set -euo pipefail

EMAIL="${1:-}"
BUDGET_USD="${2:-5}"
REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="healall-bootstrap-api"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -n "${EMAIL}" ] || { echo "Usage: $0 <email for budget alarms> [monthly budget in USD, default 5]" >&2; exit 1; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
echo "==> AWS account ${ACCOUNT}, region ${REGION}"

# Reuse the GitHub OIDC provider if one exists: an account can hold only one
# per URL, and the media stack may have created it.
PROVIDER_ARN="$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?ends_with(Arn, '/token.actions.githubusercontent.com')].Arn | [0]" \
  --output text)"
[ "${PROVIDER_ARN}" = "None" ] && PROVIDER_ARN=""
if [ -n "${PROVIDER_ARN}" ]; then
  echo "==> Reusing OIDC provider ${PROVIDER_ARN}"
else
  echo "==> No GitHub OIDC provider yet, the stack will create one"
fi

if ! aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" >/dev/null 2>&1 \
   && aws ecr describe-repositories --region "${REGION}" --repository-names healall-api >/dev/null 2>&1; then
  echo "The ECR repository healall-api already exists outside this stack." >&2
  echo "Delete it (it only holds images) or import it, then run this again." >&2
  exit 1
fi

aws cloudformation deploy --region "${REGION}" --stack-name "${STACK_NAME}" \
  --template-file "${HERE}/healall-api-bootstrap.yml" \
  --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset \
  --parameter-overrides \
    "ExistingOidcProviderArn=${PROVIDER_ARN}" \
    "BudgetEmail=${EMAIL}" \
    "MonthlyBudgetUsd=${BUDGET_USD}"

ROLE_ARN="$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='DeployRoleArn'].OutputValue" --output text)"

echo
echo "Done. In GitHub, HealAll-India/HealAll > Settings > Secrets and variables > Actions:"
echo "  Variables tab:  AWS_API_DEPLOY_ROLE_ARN = ${ROLE_ARN}"
echo "  Secrets tab:    the API secrets listed in infra/aws/bootstrap/README.md"
echo "Deploys stay off until the variable API_DEPLOY_ENABLED is set to true."
