#!/bin/bash
# Migration script to move WordPress resources from main terraform to standalone workspace
# This script uses terraform state mv to transfer resources

set -e

echo "🚀 WordPress Migration Script"
echo "=============================="
echo ""
echo "This will move WordPress resources from:"
echo "  Main workspace: devops/terraform/"
echo "  New workspace: devops/terraform-wordpress/"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

cd "$(dirname "$0")/.."

# Get resource IDs from old workspace
echo ""
echo "📋 Getting resource IDs from main workspace..."
cd terraform

OLD_STATE="terraform.tfstate.backup"
NEW_STATE="../terraform-wordpress/terraform.tfstate"

# Pull both states
echo "Pulling states..."
cd ../terraform-wordpress
terraform state pull > /tmp/new-wordpress-state.json

cd ../terraform
terraform state pull > /tmp/old-main-state.json

echo ""
echo "✅ States pulled. Ready to migrate resources."
echo ""
echo "📝 To migrate resources, run these commands:"
echo ""
echo "cd devops/terraform"
echo "# Use terraform state mv for each resource:"
echo "terraform state mv 'aws_security_group.wordpress_alb[0]' 'module.wordpress.aws_security_group.wordpress_alb' -state-out=../terraform-wordpress/terraform.tfstate"
echo ""
echo "Or use terraform import in the new workspace:"
echo ""
echo "cd devops/terraform-wordpress"
echo "# Import each resource by ID"

cat << 'IMPORT_LIST'
# Security Groups
terraform import aws_security_group.wordpress_alb $(aws ec2 describe-security-groups --profile jordan --filters "Name=group-name,Values=bianca-wordpress-alb-sg" --query 'SecurityGroups[0].GroupId' --output text)
terraform import aws_security_group.wordpress $(aws ec2 describe-security-groups --profile jordan --filters "Name=group-name,Values=bianca-wordpress-sg" --query 'SecurityGroups[0].GroupId' --output text)

# IAM Resources (get from main terraform state)
terraform import aws_iam_role.wordpress_instance_role bianca-wordpress-instance-role
terraform import aws_iam_instance_profile.wordpress_profile bianca-wordpress-instance-profile

# EBS Volumes (get from main terraform state)
terraform import aws_ebs_volume.wordpress_data vol-XXXXX
terraform import aws_ebs_volume.wordpress_db vol-XXXXX

# Load Balancer
terraform import aws_lb.wordpress arn:aws:elasticloadbalancing:us-east-2:730335291008:loadbalancer/app/bianca-wordpress-alb/XXXXX
terraform import aws_lb_target_group.wordpress arn:aws:elasticloadbalancing:us-east-2:730335291008:targetgroup/bianca-wordpress-tg/XXXXX

# Instance
terraform import aws_instance.wordpress i-XXXXX

# S3 Bucket
terraform import aws_s3_bucket.wordpress_media bianca-wordpress-media-XXXXX

# ACM Certificate (from state)
terraform import aws_acm_certificate.wordpress_cert arn:aws:acm:us-east-2:730335291008:certificate/XXXXX
IMPORT_LIST

echo ""
echo "💡 Recommended: Use terraform import with resource IDs from main workspace state"
echo "   Run: terraform state show <resource> in main workspace to get IDs"



