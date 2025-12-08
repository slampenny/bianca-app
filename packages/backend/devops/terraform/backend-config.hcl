# Backend configuration file
# Use this if backend.tf profile doesn't work
bucket  = "bianca-terraform-state"
key     = "backend/terraform.tfstate"
region  = "us-east-2"
encrypt = true
profile = "jordan"
