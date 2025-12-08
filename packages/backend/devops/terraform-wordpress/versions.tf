terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.100"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.1.0"
    }
  }

  backend "s3" {
    bucket = "bianca-terraform-state"
    key    = "wordpress/terraform.tfstate"
    region = "us-east-2"
    encrypt = true
  }
}
