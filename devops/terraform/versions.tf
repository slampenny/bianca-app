terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      # Ensure this version is >= 3.30.0. Using a recent major version is good.
      version = "~> 5.0"  # Example: Use any version from 5.0 up to (but not including) 6.0
      # Or, at minimum for this specific resource:
      # version = ">= 3.30.0"
    }
  }
  # You might also have:
  # required_version = ">= 1.0" # For the Terraform CLI version itself
}