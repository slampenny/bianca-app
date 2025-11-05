# WordPress Infrastructure - Standalone Terraform Workspace

This is a **standalone Terraform workspace** for the WordPress site at `myphonefriend.com`. It is completely independent from the main app infrastructure.

## ✅ Why This Exists

WordPress was previously managed by a conditional variable (`create_wordpress`) in the main Terraform workspace. This meant:
- Running `terraform apply` without the variable would destroy WordPress
- WordPress could accidentally be deleted during routine operations

**Now WordPress is always up** - no variables needed!

## 🚀 Quick Start

```bash
cd devops/terraform-wordpress

# Initialize (first time only)
terraform init

# See what will be created/updated
terraform plan

# Apply changes
terraform apply
```

## 📁 Structure

- `main.tf` - All WordPress resources (ALB, EC2, DNS, etc.)
- `versions.tf` - Terraform version and backend configuration
- `wordpress-userdata.sh` - Instance initialization script

## 🏗️ Resources Managed

- Application Load Balancer (ALB)
- EC2 Instance (t3.micro)
- EBS Volumes (data + database)
- Route53 DNS Records
- ACM SSL Certificate
- Security Groups
- S3 Bucket (media backups)
- IAM Roles & Policies

## 🔒 Separation

- **Backend State**: `s3://bianca-terraform-state/wordpress/terraform.tfstate`
- **Resources Tagged**: All resources tagged with `ManagedBy = "terraform-wordpress"`
- **No Dependencies**: Uses data sources to find VPC/subnets, no shared state

## 🛠️ Management

WordPress runs independently. You can:
- Apply changes: `terraform apply`
- Destroy (if needed): `terraform destroy`
- No need to remember any variables - it just works!

## 📝 Variables

Default values are set in `main.tf`. Override if needed:
- `wp_domain` - Default: "myphonefriend.com"
- `wordpress_instance_type` - Default: "t3.micro"
- `subnet_public_a_id` / `subnet_public_b_id` - Auto-discovered if not set

## ⚠️ Important

This workspace manages WordPress **only**. Changes to the main app infrastructure won't affect WordPress, and vice versa.
