# Terraform modules (WO-002A)

Create in this order; each module has `main.tf`, `variables.tf`, `outputs.tf`, and a `README.md` stating the invariants it enforces:

1. `project` — project, APIs, org policies (no external IPs, no SA keys, region lock, uniform bucket access, Cloud SQL no public IP).
2. `network` — VPC, private subnet, Private Service Connect, serverless VPC connector, Cloud NAT, deny-all egress + allowlist (`egress_allowlist` variable; changes require security review).
3. `kms` — keyring; `db-kek`, `gcs-kek`, `tenant-kek`; 90-day rotation; HSM in prod; IAM separation.
4. `cloudsql` — Postgres 16, CMEK, private IP, IAM auth, pgaudit, flags; roles `sovereign_admin` / `sovereign_app` (ADR-0009).
5. `gcs` — `artifacts`, `audit-anchors` (locked retention), `exports`, `tfstate`.
6. `pubsub` — `domain-events`, `audit-events`, `metering-events` + DLQs; ordering by `tenant_id`.
7. `iam` — per-service service accounts; WIF pool for GitHub.
8. `cloudrun-service` — reusable service module (internal ingress by default, VPC egress, binary authorization, secrets from Secret Manager, non-root).
9. `monitoring` — uptime, SLOs, alert policies (error rate, p95, Cloud SQL, outbox lag, audit-chain failure, egress-denied, break-glass).
10. `secrets` — placeholders bound to service identities.
