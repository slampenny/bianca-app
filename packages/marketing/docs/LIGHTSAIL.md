# Bianca Wellness marketing site → AWS Lightsail

Terraform: **`packages/backend/devops/terraform-marketing-wordpress/`**

WordPress source and deploy scripts: **`packages/marketing/`** (this monorepo).

## Deploy WordPress

### Lowest-risk path: EC2 (`bianca-wordpress`) → Lightsail

```bash
yarn marketing:up

cd packages/marketing/scripts
./migrate-ec2-wordpress-to-lightsail.sh
```

Optional: `BIANCA_LIGHTSAIL_HOST=3.x.x.x` to skip `terraform output`.

### Manual two-step

```bash
yarn marketing:up

cd packages/marketing/scripts
./pull-from-production.sh   # optional

export BIANCA_LIGHTSAIL_HOST="$(cd ../../backend/devops/terraform-marketing-wordpress && terraform output -raw lightsail_static_ip)"
./deploy-to-lightsail.sh
```

SSH: `~/.ssh/bianca-key-pair.pem` (same key Terraform registers on Lightsail). Override with `BIANCA_SSH_KEY`.

## DNS

When the site is verified on the static IP, set `manage_route53 = true` in `terraform-marketing-wordpress/terraform.tfvars` and `terraform apply`.

## HTTPS (Let’s Encrypt on the instance)

See `packages/backend/devops/terraform-marketing-wordpress/README.md` for `bncert-tool` steps after apex + `www` A records point at Lightsail.
