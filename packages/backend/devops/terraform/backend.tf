terraform {
  backend "s3" {
    bucket  = "bianca-terraform-state-ca-central-1"
    key     = "backend/terraform.tfstate"
    region  = "ca-central-1"
    encrypt = true
  }
}
