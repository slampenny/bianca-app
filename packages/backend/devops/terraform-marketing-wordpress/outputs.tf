output "lightsail_static_ip" {
  description = "Public IPv4 — use for smoke tests and (when ready) DNS."
  value       = aws_lightsail_static_ip.marketing.ip_address
}

output "lightsail_instance_name" {
  value = aws_lightsail_instance.marketing.name
}

output "ssh_private_key_pem_path" {
  description = "Same PEM you passed in; use with ssh -i (user: bitnami)."
  value       = var.ssh_private_key_pem_path
}

output "ssh_connect_hint" {
  description = "SSH using your bianca-key-pair.pem (Bitnami user)."
  value       = "ssh -i ${var.ssh_private_key_pem_path} bitnami@${aws_lightsail_static_ip.marketing.ip_address}"
}

output "route53_managed" {
  value = var.manage_route53
}
