# Sovereign — prod environment root (WO-002A). Skeleton: no resources until AC-01 executes.
terraform {
  required_version = ">= 1.9"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
  backend "gcs" {
    bucket = "sovereign-tfstate-prod"
    prefix = "root"
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

variable "project_id" {
  type        = string
  description = "GCP project for the prod environment (sovereign-prod)"
}

# Modules are wired in build order per docs/STAGE1_FOUNDATION_SPEC.md §3.2:
# project -> network -> kms -> cloudsql -> gcs -> pubsub -> iam -> cloudrun-service -> monitoring -> secrets
