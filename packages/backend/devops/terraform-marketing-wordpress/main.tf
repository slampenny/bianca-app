provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null
}

# TODO: Verify Lightsail is available in ca-central-1 before applying; use EC2 or another service if not.
locals {
  availability_zone = "${var.aws_region}${var.availability_zone_suffix}"
}

# Import Lightsail key pair from your existing EC2 SSH private key (PEM).
data "tls_public_key" "bianca_key_pair" {
  private_key_pem = file(pathexpand(var.ssh_private_key_pem_path))
}

resource "aws_lightsail_key_pair" "deployer" {
  name       = "${var.lightsail_instance_name}-key"
  public_key = data.tls_public_key.bianca_key_pair.public_key_openssh
}

resource "aws_lightsail_static_ip" "marketing" {
  name = var.lightsail_static_ip_name
}

resource "aws_lightsail_instance" "marketing" {
  name              = var.lightsail_instance_name
  availability_zone = local.availability_zone
  blueprint_id      = var.lightsail_blueprint_id
  bundle_id         = var.lightsail_bundle_id
  key_pair_name     = aws_lightsail_key_pair.deployer.name

  tags = {
    Site        = var.primary_domain
    Environment = "production-marketing"
    ManagedBy   = "terraform"
  }
}

resource "aws_lightsail_static_ip_attachment" "marketing" {
  static_ip_name = aws_lightsail_static_ip.marketing.name
  instance_name  = aws_lightsail_instance.marketing.name

  depends_on = [aws_lightsail_instance.marketing]
}

data "aws_route53_zone" "primary" {
  count        = var.manage_route53 ? 1 : 0
  name         = "${var.primary_domain}."
  private_zone = false
}

resource "aws_route53_record" "apex" {
  count           = var.manage_route53 ? 1 : 0
  zone_id         = data.aws_route53_zone.primary[0].zone_id
  name            = ""
  type            = "A"
  ttl             = 300
  records         = [aws_lightsail_static_ip.marketing.ip_address]
  allow_overwrite = true
}

resource "aws_route53_record" "www" {
  count           = var.manage_route53 ? 1 : 0
  zone_id         = data.aws_route53_zone.primary[0].zone_id
  name            = "www"
  type            = "A"
  ttl             = 300
  records         = [aws_lightsail_static_ip.marketing.ip_address]
  allow_overwrite = true
}
