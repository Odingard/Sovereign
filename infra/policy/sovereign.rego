package sovereign.infra

# Conftest policies over `terraform show -json plan` output (WO-002A AC-05).
# Infrastructure policy-as-code only; never application/clinical authorization.

deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_sql_database_instance"
  rc.change.after.settings[_].ip_configuration[_].ipv4_enabled == true
  msg := sprintf("Cloud SQL %s must not have a public IP", [rc.address])
}

deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_sql_database_instance"
  not rc.change.after.encryption_key_name
  msg := sprintf("Cloud SQL %s must use CMEK (encryption_key_name)", [rc.address])
}

deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_storage_bucket"
  rc.change.after.uniform_bucket_level_access != true
  msg := sprintf("Bucket %s must enable uniform bucket-level access", [rc.address])
}

deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_storage_bucket"
  not rc.change.after.encryption[_].default_kms_key_name
  msg := sprintf("Bucket %s must use CMEK", [rc.address])
}

deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_service_account_key"
  msg := sprintf("Service-account keys are prohibited: %s", [rc.address])
}

deny[msg] {
  rc := input.resource_changes[_]
  startswith(rc.type, "google_")
  loc := rc.change.after.location
  loc != null
  loc != "us-central1"
  loc != "US"
  msg := sprintf("%s location %s is outside us-central1", [rc.address, loc])
}

deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_cloud_run_v2_service"
  rc.change.after.ingress == "INGRESS_TRAFFIC_ALL"
  rc.change.after.name != "sovereign-gateway"
  msg := sprintf("Cloud Run %s must not allow all ingress (only the gateway is public)", [rc.address])
}
