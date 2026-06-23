terraform {
  backend "s3" {
    bucket  = "bianca-terraform-state"
    key     = "lightsail-marketing-wordpress/terraform.tfstate"
    # TODO: Migrate Terraform state bucket to ca-central-1 (or use a ca-central-1 bucket) before applying.
    region  = "ca-central-1"
    encrypt = true
  }
}
