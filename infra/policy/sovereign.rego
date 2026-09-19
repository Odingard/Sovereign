package sovereign.infra

import rego.v1

# Conftest policies over `terraform show -json plan` output (WO-002A AC-05).
# Infrastructure policy-as-code only; never application/clinical authorization.

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "google_sql_database_instance"
  some settings in rc.change.after.settings
  some ipc in settings.ip_configuration
  ipc.ipv4_enabled == true
  msg := sprintf("Cloud SQL %s must not have a public IP", [rc.address])
}

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "google_sql_database_instance"
  not rc.change.after.encryption_key_name
  msg := sprintf("Cloud SQL %s must use CMEK (encryption_key_name)", [rc.address])
}

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "google_storage_bucket"
  rc.change.after.uniform_bucket_level_access != true
  msg := sprintf("Bucket %s must enable uniform bucket-level access", [rc.address])
}

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "google_storage_bucket"
  count([e | some e in rc.change.after.encryption; e.default_kms_key_name]) == 0
  msg := sprintf("Bucket %s must use CMEK", [rc.address])
}

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "google_service_account_key"
  msg := sprintf("Service-account keys are prohibited: %s", [rc.address])
}

deny contains msg if {
  some rc in input.resource_changes
  startswith(rc.type, "google_")
  loc := rc.change.after.location
  loc != null
  not loc in {"us-central1", "US"}
  msg := sprintf("%s location %s is outside us-central1", [rc.address, loc])
}

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "google_cloud_run_v2_service"
  rc.change.after.ingress == "INGRESS_TRAFFIC_ALL"
  rc.change.after.name != "sovereign-gateway"
  msg := sprintf("Cloud Run %s must not allow all ingress (only the gateway is public)", [rc.address])
}
