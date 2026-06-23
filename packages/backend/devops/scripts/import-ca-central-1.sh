#!/usr/bin/env bash
# Import ca-central-1 resources created by partial terraform apply but missing from state.
# Generated from packages/backend/devops/terraform-ca-central-1-apply.txt error log.
#
# Usage (from repo root):
#   AWS_PROFILE=jordan ./packages/backend/devops/scripts/import-ca-central-1.sh
set -euo pipefail

: "${AWS_PROFILE:=jordan}"
export AWS_PROFILE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/../terraform"
cd "$TF_DIR"

ACCOUNT_ID="730335291008"
REGION="ca-central-1"

# Route53 hosted zone IDs (ca-central-1 apply created records in existing global zones)
ZONE_LEGACY="Z01139329KKK4CX1YYHV"        # myphonefriend.com
ZONE_PRIMARY="Z09789782GVH13BNCQOY9"      # biancawellness.com
ZONE_CORP="Z08125311MNVIDQQOWDZO"         # biancatechnologies.com

# Service discovery namespace (aws_service_discovery_private_dns_namespace.internal)
SD_NAMESPACE="ns-4g63dpgstauwoy6g"

# ALB ARNs
ALB_SHARED="arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT_ID}:loadbalancer/app/bianca-shared-alb/20bc0d0c7598759f"
ALB_STAGING="arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT_ID}:loadbalancer/app/bianca-staging-alb/9042accac68fdd33"
ALB_PRODUCTION="arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT_ID}:loadbalancer/app/bianca-production-alb/7e771cbf28527ebd"

# Production VPC networking (duplicate RT from partial apply — live subnets use rtb-03ee01c87bd63c234)
PRODUCTION_RT="rtb-03ee01c87bd63c234"
PRODUCTION_SUBNET_A="subnet-098565be3ac40c00d"
PRODUCTION_SUBNET_B="subnet-07f60727d75c75ee6"

# NAT gateway (state had failed nat-05be098f0688ae83e; live gateway is nat-0d45bc471cb4d37c9)
NAT_GATEWAY="nat-0d45bc471cb4d37c9"

import_resource() {
  local address="$1"
  local id="$2"
  if terraform state show "${address}" >/dev/null 2>&1; then
    echo "SKIP (already in state): ${address}"
    return 0
  fi
  echo "IMPORT: ${address} <= ${id}"
  terraform import -var="aws_profile=${AWS_PROFILE}" "${address}" "${id}"
}

reimport_resource() {
  local address="$1"
  local id="$2"
  if terraform state show "${address}" >/dev/null 2>&1; then
    echo "STATE RM (reimport): ${address}"
    terraform state rm "${address}"
  fi
  echo "IMPORT: ${address} <= ${id}"
  terraform import -var="aws_profile=${AWS_PROFILE}" "${address}" "${id}"
}

echo "=== Fixing NAT gateway state (tainted failed create) ==="
reimport_resource aws_nat_gateway.main "${NAT_GATEWAY}"

echo "=== Fixing production route table (duplicate RT from partial apply) ==="
reimport_resource aws_route_table.production "${PRODUCTION_RT}"

echo "=== IAM roles ==="
import_resource aws_iam_role.codedeploy_production_service_role bianca-codedeploy-production-service-role
import_resource aws_iam_role.codedeploy_production_ec2_role bianca-codedeploy-production-ec2-role
import_resource aws_iam_role.pipeline_notify_lambda bianca-pipeline-notify-lambda-role
import_resource aws_iam_role.codebuild_production_role bianca-codebuild-production-role
import_resource aws_iam_role.codepipeline_production_role bianca-codepipeline-production-role
import_resource aws_iam_role.asterisk_ec2_role asterisk-ec2-role
import_resource aws_iam_role.ecs_execution_role ecsTaskExecutionRole
import_resource aws_iam_role.ecs_task_role ecsTaskRole
import_resource aws_iam_role.codebuild_role CodeBuildServiceRole
import_resource aws_iam_role.codepipeline_role CodePipelineServiceRole
import_resource aws_iam_role.ses_email_forwarding_role ses-email-forwarding-role
import_resource aws_iam_role.lambda_email_forwarding_role lambda-email-forwarding-role
import_resource aws_iam_role.production_ec2_scheduler_lambda bianca-production-ec2-scheduler-lambda
import_resource aws_iam_role.production_ec2_scheduler_invoke bianca-production-ec2-scheduler-invoke
import_resource aws_iam_role.production_role bianca-production-role
import_resource aws_iam_role.staging_instance_role bianca-staging-instance-role
import_resource aws_iam_role.staging_lambda_role bianca-staging-lambda-auto-stop-role
import_resource module.staging_hipaa_backups.aws_iam_role.backup_lambda_role staging-backup-lambda-role
import_resource module.production_hipaa_backups.aws_iam_role.backup_lambda_role production-backup-lambda-role

echo "=== IAM policies ==="
import_resource aws_iam_policy.ecs_task_exec_policy "arn:aws:iam::${ACCOUNT_ID}:policy/ECSTaskExecPolicy"
import_resource aws_iam_policy.ecs_task_ses_policy "arn:aws:iam::${ACCOUNT_ID}:policy/ECSTaskSESPolicy"
import_resource aws_iam_policy.ecs_task_s3_debug_audio_policy "arn:aws:iam::${ACCOUNT_ID}:policy/ECSTaskS3DebugAudioPolicy"
import_resource aws_iam_policy.codebuild_ecr_policy "arn:aws:iam::${ACCOUNT_ID}:policy/CodeBuildECRPolicy"
import_resource aws_iam_policy.codebuild_ecs_task_def_policy "arn:aws:iam::${ACCOUNT_ID}:policy/CodeBuildECSTaskDefPolicy"
import_resource aws_iam_policy.codebuild_logs_policy "arn:aws:iam::${ACCOUNT_ID}:policy/CodeBuildLogsPolicy"
import_resource aws_iam_policy.codebuild_secrets_manager_policy "arn:aws:iam::${ACCOUNT_ID}:policy/CodeBuildSecretsManagerPolicy"
import_resource aws_iam_policy.ecs_task_sns_sms_policy "arn:aws:iam::${ACCOUNT_ID}:policy/ecs-task-sns-sms-policy"

echo "=== S3 buckets ==="
echo "SKIP: S3 bucket names are globally unique; these buckets exist in us-east-2 only."
echo "      They cannot be imported into ca-central-1 state — apply will need new bucket names"
echo "      or us-east-2 bucket deletion after migration."
echo "      Skipped: aws_s3_bucket.codedeploy_production_artifacts"
echo "      Skipped: aws_s3_bucket.artifact_bucket"
echo "      Skipped: aws_s3_bucket.debug_audio_bucket"
echo "      Skipped: module.staging_hipaa_backups.aws_s3_bucket.hipaa_backups"
echo "      Skipped: module.production_hipaa_backups.aws_s3_bucket.hipaa_backups"
echo "      Skipped: module.staging_hipaa_backups.aws_s3_bucket.backup_access_logs"
echo "      Skipped: module.production_hipaa_backups.aws_s3_bucket.backup_access_logs"

echo "=== Load balancers ==="
import_resource aws_lb.shared "${ALB_SHARED}"
import_resource aws_lb.staging "${ALB_STAGING}"
import_resource aws_lb.production "${ALB_PRODUCTION}"

echo "=== Service discovery services ==="
import_resource aws_service_discovery_service.asterisk_sd_service "${SD_NAMESPACE}/srv-o5saiyvcrhba3x43"
import_resource aws_service_discovery_service.bianca_app_sd_service "${SD_NAMESPACE}/srv-mmzsi5kfjgfoktfy"
import_resource aws_service_discovery_service.mongodb_sd_service "${SD_NAMESPACE}/srv-dxifdn5ql2pvvhxf"

echo "=== VPC endpoint & security group ==="
import_resource aws_vpc_endpoint.ecr_dkr vpce-043375e7505a6536c
import_resource aws_security_group.efs_sg sg-03644e93be3e08fa1

echo "=== Production route table associations ==="
import_resource aws_route_table_association.production_a "${PRODUCTION_SUBNET_A}/${PRODUCTION_RT}"
import_resource aws_route_table_association.production_b "${PRODUCTION_SUBNET_B}/${PRODUCTION_RT}"

echo "=== Route53 — biancatechnologies.com ==="
import_resource aws_route53_record.corp_verification "${ZONE_CORP}__amazonses.biancatechnologies.com_TXT"
import_resource aws_route53_record.zoho_mx "${ZONE_CORP}_biancatechnologies.com_MX"
import_resource aws_route53_record.zoho_spf "${ZONE_CORP}_biancatechnologies.com_TXT"
import_resource aws_route53_record.zoho_dkim "${ZONE_CORP}_zmail._domainkey.biancatechnologies.com_TXT"
import_resource aws_route53_record.twilio_verification "${ZONE_CORP}__twilio.biancatechnologies.com_TXT"

echo "=== Route53 — myphonefriend.com (legacy) ==="
import_resource aws_route53_record.ses_verification_record "${ZONE_LEGACY}__amazonses.myphonefriend.com_TXT"
import_resource aws_route53_record.ses_spf_record "${ZONE_LEGACY}_myphonefriend.com_TXT"
import_resource aws_route53_record.ses_dmarc_record "${ZONE_LEGACY}__dmarc.myphonefriend.com_TXT"
import_resource aws_route53_record.ses_mx_record "${ZONE_LEGACY}_myphonefriend.com_MX"
import_resource aws_route53_record.staging_api "${ZONE_LEGACY}_staging-api.myphonefriend.com_A"
import_resource aws_route53_record.staging_sip "${ZONE_LEGACY}_staging-sip.myphonefriend.com_A"
import_resource aws_route53_record.staging_frontend "${ZONE_LEGACY}_staging.myphonefriend.com_A"
import_resource aws_route53_record.production_api "${ZONE_LEGACY}_api.myphonefriend.com_CNAME"
import_resource aws_route53_record.production_app "${ZONE_LEGACY}_app.myphonefriend.com_CNAME"

echo "=== Route53 — biancawellness.com (primary) ==="
import_resource aws_route53_record.primary_ses_verification "${ZONE_PRIMARY}__amazonses.biancawellness.com_TXT"
import_resource aws_route53_record.primary_ses_spf_record "${ZONE_PRIMARY}_biancawellness.com_TXT"
import_resource aws_route53_record.primary_ses_dmarc_record "${ZONE_PRIMARY}__dmarc.biancawellness.com_TXT"
import_resource aws_route53_record.staging_api_primary "${ZONE_PRIMARY}_staging-api.biancawellness.com_A"
import_resource aws_route53_record.staging_sip_primary "${ZONE_PRIMARY}_staging-sip.biancawellness.com_A"
import_resource aws_route53_record.staging_frontend_primary "${ZONE_PRIMARY}_staging.biancawellness.com_A"
import_resource aws_route53_record.staging_admin_primary "${ZONE_PRIMARY}_staging-admin.biancawellness.com_A"
import_resource aws_route53_record.production_api_primary "${ZONE_PRIMARY}_api.biancawellness.com_CNAME"
import_resource aws_route53_record.production_app_primary "${ZONE_PRIMARY}_app.biancawellness.com_CNAME"
import_resource aws_route53_record.production_admin_primary "${ZONE_PRIMARY}_admin.biancawellness.com_CNAME"

echo ""
echo "All imports completed successfully."
