variable "aws_region" {
  type        = string
  description = "AWS region (Lightsail + Route53)."
  default     = "ca-central-1"
}

variable "aws_profile" {
  type        = string
  description = "AWS CLI profile for local Terraform (empty = default credential chain)."
  default     = ""
}

variable "aws_account_id" {
  type        = string
  description = "Account ID (for ARNs in outputs/docs)."
  default     = "730335291008"
}

variable "primary_domain" {
  type        = string
  description = "Marketing apex zone (same as main stack primary_domain)."
  default     = "biancawellness.com"
}

variable "lightsail_instance_name" {
  type        = string
  description = "Lightsail instance name (unique per account/region)."
  default     = "biancawellness-marketing"
}

variable "lightsail_static_ip_name" {
  type        = string
  description = "Lightsail static IP resource name."
  default     = "biancawellness-marketing-ip"
}

variable "lightsail_bundle_id" {
  type        = string
  description = "Lightsail bundle (size). See AWS pricing."
  default     = "small_3_0"
}

variable "lightsail_blueprint_id" {
  type        = string
  description = "Lightsail blueprint (Bitnami WordPress)."
  default     = "wordpress"
}

variable "availability_zone_suffix" {
  type        = string
  description = "AZ letter after region (e.g. a → ca-central-1a)."
  default     = "a"
}

variable "ssh_private_key_pem_path" {
  type        = string
  description = "Path to the existing SSH *private* key PEM (e.g. ~/.ssh/bianca-key-pair.pem). Public half is derived for Lightsail; use this same file with ssh -i."
  default     = "~/.ssh/bianca-key-pair.pem"
}

variable "manage_route53" {
  type        = bool
  description = "If true, manage apex + www A records in the primary_domain hosted zone. Set true only after smoke test on the static IP."
  default     = false
}
