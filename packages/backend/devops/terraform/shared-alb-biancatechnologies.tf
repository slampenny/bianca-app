################################################################################
# Shared ALB (bianca-shared-alb): TLS + redirect for biancatechnologies.com
#
# Default listener cert only covers *.biancawellness.com-style names; corporate
# hostnames need SNI via aws_lb_listener_certificate, then a redirect rule.
################################################################################

resource "aws_acm_certificate" "shared_alb_biancatechnologies" {
  domain_name               = "biancatechnologies.com"
  subject_alternative_names = ["www.biancatechnologies.com"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "shared-alb-biancatechnologies"
    Environment = var.environment
    Project     = "bianca"
  }
}

resource "aws_route53_record" "shared_alb_biancatechnologies_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.shared_alb_biancatechnologies.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = data.aws_route53_zone.biancatechnologies.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "shared_alb_biancatechnologies" {
  certificate_arn = aws_acm_certificate.shared_alb_biancatechnologies.arn
  validation_record_fqdns = [
    for record in aws_route53_record.shared_alb_biancatechnologies_cert_validation : record.fqdn
  ]

  timeouts {
    create = "10m"
  }
}

resource "aws_lb_listener_certificate" "shared_https_biancatechnologies" {
  listener_arn    = aws_lb_listener.shared_https.arn
  certificate_arn = aws_acm_certificate_validation.shared_alb_biancatechnologies.certificate_arn
}

# Send corporate apex/www to the primary public marketing domain (Lightsail).
resource "aws_lb_listener_rule" "biancatechnologies_redirect_to_primary" {
  listener_arn = aws_lb_listener.shared_https.arn
  priority     = 30

  action {
    type = "redirect"
    redirect {
      host        = var.primary_domain
      port        = "443"
      protocol    = "HTTPS"
      path        = "/#{path}"
      query       = "#{query}"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = [
        "biancatechnologies.com",
        "www.biancatechnologies.com",
      ]
    }
  }

  depends_on = [aws_lb_listener_certificate.shared_https_biancatechnologies]
}
