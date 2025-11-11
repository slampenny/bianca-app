################################################################################
# DOMAIN REDIRECTS - Point biancatechnologies.com and biancawellness.com to myphonefriend.com
# 
# This file creates DNS records to point both domains to the same WordPress ALB
# that serves myphonefriend.com. This allows both domains to resolve to the same website.
#
# IMPORTANT: This does NOT affect email (MX records remain unchanged)
# - biancatechnologies.com email continues to work via Zoho Mail
# - biancawellness.com email (if configured) remains unchanged
################################################################################

# Data source to find the WordPress ALB (same one used by myphonefriend.com)
# The ALB name is "bianca-wordpress-alb"
# Note: This assumes the ALB exists. If it doesn't, you may need to:
# 1. Deploy WordPress first (terraform apply with create_wordpress=true), OR
# 2. Reference the ALB from the terraform-wordpress workspace using a data source
data "aws_lb" "wordpress" {
  name = "bianca-wordpress-alb"
}

################################################################################
# BIANCATECHNOLOGIES.COM - Point to myphonefriend.com (WordPress ALB)
################################################################################

# Root domain A record (ALIAS) pointing to WordPress ALB
# This makes biancatechnologies.com resolve to the same site as myphonefriend.com
resource "aws_route53_record" "biancatechnologies_root" {
  zone_id        = data.aws_route53_zone.biancatechnologies.zone_id
  name           = "biancatechnologies.com"
  type           = "A"
  allow_overwrite = true  # Allow overwriting existing A record

  alias {
    name                   = data.aws_lb.wordpress.dns_name
    zone_id                = data.aws_lb.wordpress.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# www subdomain A record (ALIAS) pointing to WordPress ALB
resource "aws_route53_record" "biancatechnologies_www" {
  zone_id        = data.aws_route53_zone.biancatechnologies.zone_id
  name           = "www.biancatechnologies.com"
  type           = "A"
  allow_overwrite = true  # Allow overwriting existing A record

  alias {
    name                   = data.aws_lb.wordpress.dns_name
    zone_id                = data.aws_lb.wordpress.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

################################################################################
# BIANCAWELLNESS.COM - Point to myphonefriend.com (WordPress ALB)
################################################################################

# Root domain A record (ALIAS) pointing to WordPress ALB
# This makes biancawellness.com resolve to the same site as myphonefriend.com
resource "aws_route53_record" "biancawellness_root" {
  zone_id = data.aws_route53_zone.biancawellness.zone_id
  name    = "biancawellness.com"
  type    = "A"

  alias {
    name                   = data.aws_lb.wordpress.dns_name
    zone_id                = data.aws_lb.wordpress.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# www subdomain A record (ALIAS) pointing to WordPress ALB
resource "aws_route53_record" "biancawellness_www" {
  zone_id = data.aws_route53_zone.biancawellness.zone_id
  name    = "www.biancawellness.com"
  type    = "A"

  alias {
    name                   = data.aws_lb.wordpress.dns_name
    zone_id                = data.aws_lb.wordpress.zone_id
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

