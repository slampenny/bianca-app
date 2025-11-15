# GitHub Actions OIDC Provider and IAM Role
# This allows GitHub Actions to assume an IAM role without storing credentials in GitHub Secrets

# OIDC Provider for GitHub Actions
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1", # GitHub's OIDC thumbprint
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"  # Backup thumbprint
  ]

  tags = {
    Name        = "github-actions-oidc"
    Environment = "shared"
    Purpose     = "GitHub Actions CI/CD"
  }
}

# IAM Role for GitHub Actions
resource "aws_iam_role" "github_actions" {
  name = "github-actions-deploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Only allow from the backend repository (where the workflow runs)
            # Note: Repository name is bianca-app-backend (not bianca-backend-app)
            "token.actions.githubusercontent.com:sub" = "repo:slampenny/bianca-app-backend:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "github-actions-deploy-role"
    Environment = "shared"
    Purpose     = "GitHub Actions CI/CD"
  }
}

# IAM Policy for GitHub Actions deployments
resource "aws_iam_policy" "github_actions_deploy" {
  name        = "GitHubActionsDeployPolicy"
  description = "Permissions for GitHub Actions to deploy to staging"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetAuthorizationToken must be allowed with Resource: "*" (cannot be restricted to specific repos)
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = [
          "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/bianca-app-backend",
          "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/bianca-app-frontend",
          "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/bianca-app-asterisk"
        ]
      },
      {
        # DescribeInstances is a list operation and cannot use resource-based conditions
        # It needs to be allowed without conditions to list instances
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceStatus"
        ]
        Resource = "*"
      },
      {
        # Start/Stop/Reboot operations can use resource-based conditions
        Effect = "Allow"
        Action = [
          "ec2:StartInstances",
          "ec2:StopInstances",
          "ec2:RebootInstances"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ec2:ResourceTag/Name" = "bianca-staging"
          }
        }
      },
      {
        # SSM SendCommand requires permissions on BOTH the document AND the instances
        # For AWS managed documents, allow on all documents in the region
        # This is necessary because AWS managed documents may use different ARN formats
        Effect = "Allow"
        Action = [
          "ssm:SendCommand"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}::document/*",
          "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:document/*"
        ]
      },
      {
        # Allow SendCommand on EC2 instances with tag condition
        Effect = "Allow"
        Action = [
          "ssm:SendCommand"
        ]
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${var.aws_account_id}:instance/*"
        ]
        Condition = {
          StringEquals = {
            "ec2:ResourceTag/Name" = "bianca-staging"
          }
        }
      },
      {
        # Get command results and describe instances
        Effect = "Allow"
        Action = [
          "ssm:GetCommandInvocation",
          "ssm:DescribeInstanceInformation",
          "ssm:ListCommands",
          "ssm:ListCommandInvocations"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::bianca-terraform-state/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          "arn:aws:s3:::bianca-terraform-state"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/terraform-state-lock"
        ]
      },
      {
        # Terraform needs read-only access to query all resources in state
        # These are read-only operations required for terraform plan/apply
        Effect = "Allow"
        Action = [
          # EC2 read operations
          "ec2:DescribeImages",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeVpcs",
          "ec2:DescribeAddresses",
          "ec2:DescribeAddressesAttribute",
          "ec2:DescribeVolumes",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeRouteTables",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeNatGateways",
          "ec2:DescribeNetworkAcls",
          "ec2:DescribeVpcAttribute",
          "ec2:DescribeTags",
          # ELBv2 (ALB) read operations
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeLoadBalancerAttributes",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTargetGroupAttributes",
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeListenerAttributes",
          "elasticloadbalancing:DescribeTags",
          # Route53 read operations
          "route53:ListHostedZones",
          "route53:GetHostedZone",
          "route53:ListResourceRecordSets",
          "route53:ListTagsForResource",
          # ACM read operations
          "acm:ListCertificates",
          "acm:DescribeCertificate",
          "acm:GetCertificate",
          "acm:ListTagsForCertificate",
          # IAM read operations (for resources Terraform manages)
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:GetOpenIDConnectProvider",
          "iam:GetInstanceProfile",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole",
          # KMS read operations
          "kms:DescribeKey",
          "kms:GetKeyPolicy",
          "kms:ListKeys",
          "kms:ListAliases",
          # S3 read operations (beyond state bucket)
          "s3:GetBucketPublicAccessBlock",
          "s3:GetBucketVersioning",
          "s3:GetBucketLifecycleConfiguration",
          "s3:GetBucketLogging",
          "s3:GetBucketPolicy",
          "s3:GetBucketOwnershipControls",
          "s3:GetBucketAcl",
          "s3:GetBucketCors",
          "s3:GetBucketWebsite",
          "s3:GetAccelerateConfiguration",
          # EFS read operations
          "elasticfilesystem:DescribeFileSystems",
          "elasticfilesystem:DescribeMountTargets",
          # ECS read operations
          "ecs:DescribeClusters",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:ListTasks",
          # ECR read operations (already have some, adding DescribeRepositories)
          "ecr:DescribeRepositories",
          "ecr:ListTagsForResource",
          # CloudWatch Logs read operations
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:ListTagsForResource",
          # EventBridge read operations
          "events:DescribeRule",
          "events:ListRules",
          "events:ListTagsForResource",
          # SES read operations
          "ses:GetIdentityVerificationAttributes",
          "ses:DescribeReceiptRuleSet",
          "ses:ListIdentities",
          # SNS read operations
          "sns:GetTopicAttributes",
          "sns:ListTopics",
          "sns:ListTagsForResource"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "github_actions_deploy" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions_deploy.arn
}

# Output the role ARN for use in GitHub Actions
output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "ARN of the IAM role for GitHub Actions (use this in GitHub Actions workflow)"
}

