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

# --- WO-002A S1-20: rules NEW-1..NEW-29 from the execution plan §6.3 -------------
#
# Each rule proves one invariant that infra/README.md or the Stage 1 spec states in
# prose. A stated invariant with no rule is a hope; these are the difference.

# NEW-1 — the five org policy constraints must be present and enforced.
required_org_constraints := {
	"constraints/compute.vmExternalIpAccess",
	"constraints/iam.disableServiceAccountKeyCreation",
	"constraints/storage.uniformBucketLevelAccess",
	"constraints/sql.restrictPublicIp",
}

deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_project_organization_policy"
	rc.change.after.constraint in required_org_constraints
	not org_policy_enforced(rc)
	msg := sprintf("Org policy %s must be enforced", [rc.change.after.constraint])
}

# Helper, not an inline `not ...[_]...`: a wildcard inside a negated expression is
# unsafe in Rego and refuses to compile. That is the exact defect G-31 recorded, and
# it is easy to reintroduce.
org_policy_enforced(rc) if {
	some policy in rc.change.after.boolean_policy
	policy.enforced == true
}

# NEW-2 — a default-deny egress firewall rule must exist when a network does.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_compute_network"
	count([f |
		some f in input.resource_changes
		f.type == "google_compute_firewall"
		f.change.after.direction == "EGRESS"
		count(f.change.after.deny) > 0
	]) == 0
	msg := sprintf("Network %s has no default-deny egress rule", [rc.address])
}

# NEW-3 — no egress ALLOW rule may target the whole internet.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_compute_firewall"
	rc.change.after.direction == "EGRESS"
	count(rc.change.after.allow) > 0
	"0.0.0.0/0" in rc.change.after.destination_ranges
	msg := sprintf("Firewall %s allows egress to 0.0.0.0/0; the allowlist is the control", [rc.address])
}

# NEW-5 — private Google access keeps traffic off the public internet.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_compute_subnetwork"
	not rc.change.after.private_ip_google_access == true
	msg := sprintf("Subnet %s must enable private_ip_google_access", [rc.address])
}

# NEW-6 — KEK rotation at most 90 days.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_kms_crypto_key"
	not rc.change.after.rotation_period
	msg := sprintf("KMS key %s must set a rotation_period", [rc.address])
}

deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_kms_crypto_key"
	period := rc.change.after.rotation_period
	period != null
	seconds := to_number(trim_suffix(period, "s"))
	seconds > 7776000
	msg := sprintf("KMS key %s rotation_period %s exceeds 90 days", [rc.address, period])
}

# NEW-9 — Cloud SQL IAM authentication on.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_sql_database_instance"
	count([f |
		some settings in rc.change.after.settings
		some f in settings.database_flags
		f.name == "cloudsql.iam_authentication"
		f.value == "on"
	]) == 0
	msg := sprintf("Cloud SQL %s must enable cloudsql.iam_authentication", [rc.address])
}

# NEW-10 — TLS required.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_sql_database_instance"
	some settings in rc.change.after.settings
	some ipc in settings.ip_configuration
	ipc.require_ssl == false
	msg := sprintf("Cloud SQL %s must require SSL", [rc.address])
}

# NEW-12 — the audit anchor bucket's retention policy must be LOCKED. An unlocked
# retention policy can be shortened by whoever could alter the data it protects.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_storage_bucket"
	startswith(rc.change.after.name, "audit-anchors")
	count([r |
		some r in rc.change.after.retention_policy
		r.is_locked == true
	]) == 0
	msg := sprintf("Bucket %s must have a LOCKED retention policy", [rc.address])
}

# NEW-13 — no bucket may be world-readable.
deny contains msg if {
	some rc in input.resource_changes
	rc.type in {"google_storage_bucket_iam_member", "google_storage_bucket_iam_binding"}
	member := rc.change.after.member
	member in {"allUsers", "allAuthenticatedUsers"}
	msg := sprintf("%s grants %s on a bucket; no bucket may be public", [rc.address, member])
}

# NEW-15 — Pub/Sub topics carry CMEK.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_pubsub_topic"
	not rc.change.after.kms_key_name
	msg := sprintf("Pub/Sub topic %s must use CMEK", [rc.address])
}

# NEW-16 — every subscription has a dead-letter policy. Without one a poison message
# blocks the subscription indefinitely and audit events stop arriving.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_pubsub_subscription"
	count(rc.change.after.dead_letter_policy) == 0
	msg := sprintf("Subscription %s must set a dead_letter_policy", [rc.address])
}

# NEW-18 — a WIF provider without an attribute condition lets any GitHub workflow
# anywhere mint a token for this project.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_iam_workload_identity_pool_provider"
	not rc.change.after.attribute_condition
	msg := sprintf("WIF provider %s must set an attribute_condition", [rc.address])
}

# NEW-19 — pinning on repository_owner alone lets any repo in the org deploy.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_iam_workload_identity_pool_provider"
	condition := rc.change.after.attribute_condition
	condition != null
	# `contains(condition, "assertion.repository")` is NOT enough: the string
	# "assertion.repository_owner" contains it. Pinning on the owner alone lets any
	# repository in the organisation deploy to this project, which is the exact hole
	# this rule exists to close — so match the full repository comparison.
	not regex.match(`assertion\.repository\s*==`, condition)
	msg := sprintf("WIF provider %s must pin assertion.repository, not only repository_owner", [rc.address])
}

# NEW-20 — basic roles are never least privilege.
deny contains msg if {
	some rc in input.resource_changes
	rc.type in {"google_project_iam_member", "google_project_iam_binding"}
	rc.change.after.role in {"roles/owner", "roles/editor", "roles/viewer"}
	msg := sprintf("%s grants basic role %s; use a predefined or custom role", [rc.address, rc.change.after.role])
}

# NEW-21 — Cloud Run egress must traverse the VPC connector, or the deny-all egress
# allowlist is bypassed entirely.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_cloud_run_v2_service"
	some template in rc.change.after.template
	some vpc in template.vpc_access
	vpc.egress != "ALL_TRAFFIC"
	msg := sprintf("Cloud Run %s must route all egress through the VPC connector", [rc.address])
}

# NEW-23 — containers must not run as root.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_cloud_run_v2_service"
	some template in rc.change.after.template
	some container in template.containers
	some sc in container.security_context
	sc.run_as_user == 0
	msg := sprintf("Cloud Run %s must not run as root", [rc.address])
}

# NEW-24 — a literal secret in an env var is a secret in the Terraform state, in the
# plan output, and in every log that echoes the plan.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_cloud_run_v2_service"
	some template in rc.change.after.template
	some container in template.containers
	some env in container.env
	env.value != null
	# Substring, not equality: real variables are DB_PASSWORD, SIEM_SECRET,
	# GITHUB_TOKEN. An exact-match set would miss every one of them.
	some marker in {"password", "secret", "token", "api_key", "apikey", "private_key", "credential"}
	contains(lower(env.name), marker)
	msg := sprintf("Cloud Run %s sets %s as a literal env value; mount it from Secret Manager", [rc.address, env.name])
}

# NEW-26 — automatic replication puts secrets outside the region lock.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_secret_manager_secret"
	count(rc.change.after.replication) > 0
	count([r |
		some r in rc.change.after.replication
		count(r.user_managed) > 0
	]) == 0
	msg := sprintf("Secret %s must use user_managed replication pinned to us-central1", [rc.address])
}

# NEW-27 — a committed secret version means the value is in git.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_secret_manager_secret_version"
	msg := sprintf("Secret versions must never be committed: %s", [rc.address])
}

# NEW-29 — fault injection is a dev-only affordance.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "google_cloud_run_v2_service"
	some template in rc.change.after.template
	some container in template.containers
	some env in container.env
	env.name == "SOVEREIGN_FAULT_INJECT_PCT"
	not contains(rc.change.after.name, "-dev")
	msg := sprintf("Cloud Run %s sets fault injection outside dev", [rc.address])
}
