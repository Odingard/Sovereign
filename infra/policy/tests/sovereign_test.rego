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

# --- S1-20 regression tests for rules that were wrong on first write -------------
#
# Both of these passed their fixture only after a fix. A rule that has been wrong once
# gets a unit test, because the failure mode was silent: the gate reported green while
# accepting the thing it exists to reject.

# The WIF rule originally used contains(condition, "assertion.repository"), which is
# satisfied by "assertion.repository_owner" — so owner-only pinning slipped through.
test_wif_owner_only_is_denied if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "module.iam.google_iam_workload_identity_pool_provider.github",
		"type": "google_iam_workload_identity_pool_provider",
		"change": {"after": {"attribute_condition": "assertion.repository_owner=='Odingard'"}},
	}]}
}

test_wif_repository_pinned_is_allowed if {
	count(deny) == 0 with input as {"resource_changes": [{
		"address": "module.iam.google_iam_workload_identity_pool_provider.github",
		"type": "google_iam_workload_identity_pool_provider",
		"change": {"after": {"attribute_condition": "assertion.repository=='Odingard/Sovereign'"}},
	}]}
}

# The inline-secret rule originally compared the whole env name against a set of bare
# words, so DB_PASSWORD and GITHUB_TOKEN — the names people actually use — did not match.
test_inline_secret_env_is_denied if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "module.cloudrun.google_cloud_run_v2_service.api",
		"type": "google_cloud_run_v2_service",
		"change": {"after": {
			"name": "sovereign-api",
			"location": "us-central1",
			"ingress": "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
			"template": [{
				"vpc_access": [{"egress": "ALL_TRAFFIC"}],
				"containers": [{"env": [{"name": "DB_PASSWORD", "value": "hunter2"}]}],
			}],
		}},
	}]}
}

test_secret_ref_env_is_allowed if {
	count(deny) == 0 with input as {"resource_changes": [{
		"address": "module.cloudrun.google_cloud_run_v2_service.api",
		"type": "google_cloud_run_v2_service",
		"change": {"after": {
			"name": "sovereign-api",
			"location": "us-central1",
			"ingress": "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
			"template": [{
				"vpc_access": [{"egress": "ALL_TRAFFIC"}],
				"containers": [{"env": [{"name": "DB_PASSWORD", "value_source": {"secret_key_ref": {"secret": "db-password"}}}]}],
			}],
		}},
	}]}
}

# The org-policy rule reintroduced the unsafe-wildcard-in-negation defect that G-31
# recorded. It refused to compile, which is the loud failure — but the shape is easy to
# write again, so the rule keeps a test.
test_unenforced_org_policy_is_denied if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "module.project.google_project_organization_policy.no_sa_keys",
		"type": "google_project_organization_policy",
		"change": {"after": {
			"constraint": "constraints/iam.disableServiceAccountKeyCreation",
			"boolean_policy": [{"enforced": false}],
		}},
	}]}
}

test_enforced_org_policy_is_allowed if {
	count(deny) == 0 with input as {"resource_changes": [{
		"address": "module.project.google_project_organization_policy.no_sa_keys",
		"type": "google_project_organization_policy",
		"change": {"after": {
			"constraint": "constraints/iam.disableServiceAccountKeyCreation",
			"boolean_policy": [{"enforced": true}],
		}},
	}]}
}

test_locked_audit_anchor_retention_is_required if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "module.gcs.google_storage_bucket.audit_anchors",
		"type": "google_storage_bucket",
		"change": {"after": {
			"name": "audit-anchors-dev",
			"location": "US",
			"uniform_bucket_level_access": true,
			"encryption": [{"default_kms_key_name": "k"}],
			"retention_policy": [{"retention_period": 220752000, "is_locked": false}],
		}},
	}]}
}
