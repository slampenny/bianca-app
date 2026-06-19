# Marketing WordPress (biancawellness.com apex) — Lightsail

Isolated Terraform root: **own S3 state key**, separate from `devops/terraform/`.

## What it creates

- **Lightsail key pair** imported from your **`bianca-key-pair.pem`** (Terraform reads the PEM, derives the public key, registers it in Lightsail).
- **Lightsail** Bitnami WordPress instance + **static IP**.
- Optional **Route 53** apex + `www` **A** records when `manage_route53 = true` (uses **`allow_overwrite`** so existing A records can be repointed to Lightsail).

SSH user on Bitnami images: **`bitnami`**.

```bash
ssh -i ~/.ssh/bianca-key-pair.pem bitnami@$(terraform output -raw lightsail_static_ip)
```

Set **`ssh_private_key_pem_path`** in `terraform.tfvars` if your PEM is not at `~/.ssh/bianca-key-pair.pem`.

**Note:** Terraform reads the private key at plan/apply time; restrict access to this repo, tfvars, and state. Prefer `chmod 600` on the PEM.

## HTTPS (TLS)

**Reusing the Route53-validated ACM cert on Lightsail is not possible.** AWS ACM issues certs for use with integrated services (ALB, CloudFront, etc.); the **private key is not exportable**, so you cannot paste that same cert into Apache on the VM. Keeping ACM without adding an ALB would mean putting **CloudFront** (or similar) in front of Lightsail as the TLS terminator—extra architecture and cost.

**Practical fix for Bitnami WordPress on Lightsail:** install a **Let’s Encrypt** certificate with Bitnami’s tool **after** apex and `www` **A records** point at the Lightsail static IP:

```bash
cd packages/backend/devops/terraform-marketing-wordpress
ssh -i ~/.ssh/bianca-key-pair.pem bitnami@$(terraform output -raw lightsail_static_ip)
sudo /opt/bitnami/bncert-tool
```

At the prompts: list **`biancawellness.com www.biancawellness.com`** (space-separated), enable **HTTP → HTTPS redirect**, and supply an email for expiry notices.

**Before you run it:** in the Lightsail console, confirm the instance **networking / firewall** allows **TCP 80** and **443** from the internet (Let’s Encrypt uses HTTP-01 on port 80). Afterward, in WP Admin → **Settings → General**, ensure **WordPress Address** and **Site Address** use **`https://`** if they still show `http://`.

References: [Lightsail WordPress + bncert](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-enabling-https-on-wordpress-with-bncert.html), [Bitnami Let’s Encrypt on AWS](https://docs.bitnami.com/aws/how-to/generate-install-lets-encrypt-ssl/).

## Apply

```bash
cd packages/backend/devops/terraform-marketing-wordpress
terraform init
terraform plan
terraform apply
```

State file: `s3://bianca-terraform-state/lightsail-marketing-wordpress/terraform.tfstate` (same bucket as main stack, **different key**).

If you removed `biancawellness.com` / `www` Route53 records from the main `devops/terraform` stack, **apply this root first** (or in the same change window) so apex + `www` **A** records keep pointing at the Lightsail static IP.

## Deploy WordPress content

The WordPress tree and deploy scripts live in **`packages/marketing/`** — see that folder’s **`README.md`** and **`docs/LIGHTSAIL.md`**.
