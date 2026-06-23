# Mirrors packages/backend/devops/terraform/main.tf defaults for this account/domain.
# ssh_private_key_pem_path: same key as EC2 / pull-from-production (Lightsail imports the public half).

aws_region               = "ca-central-1"
aws_account_id           = "730335291008"
aws_profile              = "jordan"
primary_domain           = "biancawellness.com"
manage_route53           = true
ssh_private_key_pem_path = "~/.ssh/bianca-key-pair.pem"

# Optional overrides:
# lightsail_bundle_id     = "small_3_0"
# lightsail_instance_name = "biancawellness-marketing"
