#!/usr/bin/env bash
#
# One-shot bootstrap deploy for the HealAll media CFN stack.
#
# Run this once locally (root credentials are fine) to provision the buckets
# and IAM identities.  Afterwards, the GitHub Actions workflow
# (.github/workflows/aws-infra.yml) keeps the stack in sync on every push to
# main that touches infra/aws/cloudformation/.
#
# Prerequisites:
#   * awscli v2 installed and `aws sts get-caller-identity` works.
#   * Default region set to ap-south-1 (Mumbai) or pass AWS_REGION=...
#
# Usage:
#   ./infra/aws/cloudformation/deploy.sh                # uses defaults (prod)
#   ENVIRONMENT=dev ./infra/aws/cloudformation/deploy.sh
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-prod}"
REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="healall-media-${ENVIRONMENT}"
TEMPLATE_FILE="$(cd "$(dirname "$0")" && pwd)/healall-media.yml"

echo "Deploying CFN stack: ${STACK_NAME} in ${REGION}"
aws cloudformation deploy \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}" \
  --template-file "${TEMPLATE_FILE}" \
  --parameter-overrides "Environment=${ENVIRONMENT}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

echo
echo "Outputs:"
aws cloudformation describe-stacks \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table
