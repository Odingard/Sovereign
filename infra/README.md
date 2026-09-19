# Sovereign Infrastructure as Code

Governed by WO-002A and `docs/STAGE1_FOUNDATION_SPEC.md` §3. No cloud resource may exist outside Terraform; console changes are defects.

## Layout

- `modules/` — reusable modules in build order: `project`, `network`, `kms`, `cloudsql`, `gcs`, `pubsub`, `iam`, `cloudrun-service`, `monitoring`, `secrets`.
- `envs/{dev,staging,prod}/` — one root per environment (one GCP project each). State: GCS backend `tfstate-<env>` (versioned, CMEK).
- `policy/` — Conftest (OPA) policies evaluated against `terraform plan` JSON in CI. This is the **only** use of OPA in Sovereign; application and clinical authorization use the domain `AuthorizationEvaluator` (ADR-0010/0011).

## Invariants enforced by policy

1. No external IPs on compute; Cloud SQL private IP only.
2. Service-account key creation disabled (org policy) — GitHub authenticates via Workload Identity Federation.
3. Resource location restricted to `us-central1`.
4. CMEK on Cloud SQL, GCS, Pub/Sub, Secret Manager.
5. Uniform bucket-level access; no public buckets; `audit-anchors-*` retention locked.
6. Deny-all egress with an explicit allowlist (data in the `network` module; changes require security review).

## Status

Skeleton only. Modules and environment roots are created under WO-002A. Every service provisioned here remains `RESEARCH / NOT APPROVED FOR PHI` in `docs/SERVICE_ELIGIBILITY_MATRIX.md` until promoted; all environments carry synthetic data only until G0-B GO.
