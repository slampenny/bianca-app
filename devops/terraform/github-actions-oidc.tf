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
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
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
        # Start/Stop operations can use resource-based conditions
        Effect = "Allow"
        Action = [
          "ec2:StartInstances",
          "ec2:StopInstances"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ec2:ResourceTag/Name" = "bianca-staging"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
          "ssm:DescribeInstanceInformation"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ssm:resourceTag/Name" = "bianca-staging"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:document/AWS-RunShellScript"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::bianca-terraform-state/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
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
          "dynamodb:DeleteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/terraform-state-lock"
        ]
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

