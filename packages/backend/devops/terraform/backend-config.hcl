# Backend configuration file
# Use this if backend.tf profile doesn't work
bucket  = "bianca-terraform-state-ca-central-1"
key     = "backend/terraform.tfstate"
region  = "ca-central-1"
encrypt = true
profile = "jordan"
