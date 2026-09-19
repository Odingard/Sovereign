package sovereign.infra

import rego.v1

# Negative tests (WO-002A AC-05): non-compliant plans must be denied.

test_public_ip_sql_denied if {
  count(deny) > 0 with input as {"resource_changes": [{
    "address": "google_sql_database_instance.db", "type": "google_sql_database_instance",
    "change": {"after": {"encryption_key_name": "k", "settings": [{"ip_configuration": [{"ipv4_enabled": true}]}]}}}]}
}

test_sql_without_cmek_denied if {
  count(deny) > 0 with input as {"resource_changes": [{
    "address": "google_sql_database_instance.db", "type": "google_sql_database_instance",
    "change": {"after": {"settings": [{"ip_configuration": [{"ipv4_enabled": false}]}]}}}]}
}

test_sa_key_denied if {
  count(deny) > 0 with input as {"resource_changes": [{
    "address": "google_service_account_key.k", "type": "google_service_account_key", "change": {"after": {}}}]}
}

test_wrong_region_denied if {
  count(deny) > 0 with input as {"resource_changes": [{
    "address": "google_storage_bucket.b", "type": "google_storage_bucket",
    "change": {"after": {"location": "EU", "uniform_bucket_level_access": true, "encryption": [{"default_kms_key_name": "k"}]}}}]}
}

test_compliant_bucket_allowed if {
  count(deny) == 0 with input as {"resource_changes": [{
    "address": "google_storage_bucket.b", "type": "google_storage_bucket",
    "change": {"after": {"location": "US", "uniform_bucket_level_access": true, "encryption": [{"default_kms_key_name": "k"}]}}}]}
}
