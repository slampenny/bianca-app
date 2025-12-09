terraform {
  backend "s3" {
    bucket  = "bianca-terraform-state"
    key     = "backend/terraform.tfstate"
    region  = "us-east-2"
    encrypt = true
  }
} 