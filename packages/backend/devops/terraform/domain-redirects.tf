################################################################################
# DOMAIN REDIRECTS — biancatechnologies.com → shared ALB
#
# biancawellness.com apex + www are managed by terraform-marketing-wordpress
# (Lightsail static A records). Do not define them here — avoids Route53 drift.
#
# biancatechnologies.com / www ALIAS to bianca-shared-alb; HTTPS uses an extra ACM
# cert (SNI) + listener rule in shared-alb-biancatechnologies.tf to redirect to
# primary_domain (public marketing site).
#
# IMPORTANT: This does NOT affect email (MX records remain unchanged)
# - biancatechnologies.com email continues to work via Zoho Mail
################################################################################

data "aws_lb" "shared_public_alb" {
  name = "bianca-shared-alb"
}

################################################################################
# BIANCATECHNOLOGIES.COM — ALIAS to shared ALB
################################################################################

resource "aws_route53_record" "biancatechnologies_root" {
  zone_id         = data.aws_route53_zone.biancatechnologies.zone_id
  name            = "biancatechnologies.com"
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = data.aws_lb.shared_public_alb.dns_name
    zone_id                = data.aws_lb.shared_public_alb.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "biancatechnologies_www" {
  zone_id         = data.aws_route53_zone.biancatechnologies.zone_id
  name            = "www.biancatechnologies.com"
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = data.aws_lb.shared_public_alb.dns_name
    zone_id                = data.aws_lb.shared_public_alb.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

################################################################################
# EMAIL FORWARDING SETUP (ZOHO MAIL)
################################################################################
#
# ⚠️ IMPORTANT: Email forwarding must be configured in Zoho Mail directly.
# Terraform cannot manage Zoho Mail forwarding rules.
#
# To forward support@biancatechnologies.com to vthaker@biancatechnologies.com
# and allow replies from support@biancatechnologies.com:
#
# 1. Log in to Zoho Mail Admin Console:
#    https://mailadmin.zoho.com
#
# 2. Navigate to: Email Forwarding / Email Routing
#
# 3. Create a forwarding rule:
#    - From: support@biancatechnologies.com
#    - To: vthaker@biancatechnologies.com
#    - Keep a copy: Yes (optional, to keep emails in support@ inbox)
#
# 4. To allow vthaker@biancatechnologies.com to reply as support@:
#    - In Zoho Mail web interface, go to Settings > Mail > Send Mail As
#    - Add support@biancatechnologies.com as a "Send Mail As" address
#    - Verify the address (Zoho will send a verification email)
#
# 5. Alternatively, create an email group/alias:
#    - Create a group: support@biancatechnologies.com
#    - Add vthaker@biancatechnologies.com as a member
#    - This allows vthaker to receive and reply as support@
#
# Note: The MX records for biancatechnologies.com are already configured
# in corp-email-forwarding.tf and point to Zoho Mail servers.
# These DNS records will NOT be affected by the domain redirects above.
#
################################################################################
