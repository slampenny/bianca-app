terraform {
  backend "s3" {
    bucket  = "bianca-terraform-state"
    key     = "lightsail-marketing-wordpress/terraform.tfstate"
    region  = "us-east-2"
    encrypt = true
  }
}
