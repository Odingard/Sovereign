# WO-002A — Execution Plan

Prepared by: implementing engineer (Claude Code, Opus 5)
Date: 2026-09-19
Branch: `wo/002a-platform-foundation-gap-closure`
HEAD at time of writing: `1b93aae`
Governing WO: `work-orders/WO-002A-cloud-foundation-iac-cicd.md`
Status: **PLAN ONLY — no infrastructure created, no workflow modified, no application code written.**

> This plan is a proposal. Nothing in it is self-approved. It ends with a request for Founder GO on ticket S1-01 only.

---

## 1. Scope confirmation

### 1.1 Scope restated

WO-002A builds the *governed path* — the cloud fabric and the pipeline that carries code to it — before any clinical service exists. Concretely, five things:

1. **Three isolated GCP environments** (`sovereign-dev`, `sovereign-staging`, `sovereign-prod`) in `us-central1`, each its own project under one folder, each built entirely from Terraform. Ten reusable modules; three environment roots.
2. **Policy-as-code that can actually fail a build** — Conftest/OPA over `terraform plan` JSON plus Checkov, with deliberately non-compliant plans committed as negative tests.
3. **Supply-chain gates** — SAST, SCA, secrets, container and IaC scanning, DAST, SBOM in both CycloneDX and SPDX, cosign keyless signing, SLSA provenance — every one of them required on `main` and non-bypassable.
4. **A promotion pipeline with rings** — build → Artifact Registry → migration job → Cloud Run traffic rings (internal canary → 1% → 10% → 50% → 100%) with automatic rollback on SLO burn or P99 breach, proven by fault injection on dev.
5. **The governance artifacts that make the above auditable** — STRIDE/DREAD threat model, Data Residency & Sovereignty Matrix, k6 load model, first chaos/DR drill with measured RTO/RPO, status page, on-call tiers, PIR template, Service Eligibility Matrix updates.

The unifying rule (`work-orders/WO-002A-cloud-foundation-iac-cicd.md:38`): **no cloud resource exists outside Terraform; a console change is a defect.**

### 1.2 Out of scope restated

Per `work-orders/WO-002A-cloud-foundation-iac-cicd.md:34`, this work order does **not** build: the identity edge or gateway (WO-002B), the audit chain, crypto or telemetry packages (WO-002C), any PHI in any environment (G0-B remains HOLD per `work-orders/gate-records/WO-000-gate-record.md:18-21`), penetration-test execution (pre-G6), or pricing.

Two scope boundaries I will hold that are easy to drift across:

- **S1-01 creates *empty* `packages/kernel`, `packages/crypto`, `packages/telemetry` scaffolds** — directory, `package.json`, tier registration in `scripts/verify-architecture.ts`, and a placeholder export. Their *behavior* is WO-002B/WO-002C (spec tickets S1-05, S1-06, S1-07 at `docs/STAGE1_FOUNDATION_SPEC.md:536-538`). If the boundary test requires a real export to compile, it gets a typed no-op, not an implementation.
- **`cloudrun-service` module ships with a hello service only.** Proving private connectivity (AC-002A-03) needs *a* Cloud Run service; it does not need *the gateway*. The hello service is deleted or left as a permanent synthetic canary — see §12 Q4.

### 1.3 Acceptance criteria → satisfying artifact

| AC | Requirement | Artifact that satisfies it | Ticket |
|---|---|---|---|
| AC-002A-01 | `infra/envs/{dev,staging,prod}` apply cleanly from CI via WIF; no SA keys in any project | CI run link for `terraform apply` on each root + `gcloud iam service-accounts keys list` output across all SAs showing only Google-managed keys, captured in the gate record | S1-02 |
| AC-002A-02 | Org-policy assertions pass (no external IPs, no SA keys, region lock, uniform bucket access) — automated | `tests/infra/org-policy.test.ts` asserting live `gcloud resource-manager org-policies describe` output per constraint per project; runs in CI post-apply | S1-02 |
| AC-002A-03 | Cloud SQL, GCS, Pub/Sub, KMS, Secret Manager provisioned with CMEK; private connectivity proven from a Cloud Run hello service | Terraform state + hello service log showing a successful private-IP Postgres `SELECT 1` and a KMS decrypt, with no public IP on the instance | S1-03 |
| AC-002A-04 | Deny-all egress proven; allowlisted destination reachable, non-allowlisted blocked and alerted | Hello-service test hitting `oauth2.googleapis.com` (allowed, 200) and `example.com` (blocked, timeout) + the firing alert screenshot/`gcloud alpha monitoring` incident JSON | S1-03 |
| AC-002A-05 | Conftest/Checkov gates fail a deliberately non-compliant plan | `infra/policy/negative/*.tf` fixtures + `infra/policy/*_test.rego` unit tests + a CI job asserting non-zero exit on each fixture | S1-20 |
| AC-002A-06 | SAST, SCA, secrets, container scan, SBOM (CycloneDX + SPDX), cosign signature, SLSA provenance on a tagged build | Release run for tag `v0.2.0-foundation-rc1` with all artifacts attached; `cosign verify` and `gh attestation verify` transcripts | S1-20 |
| AC-002A-07 | ZAP baseline on PR preview; authenticated ZAP nightly on staging; high findings block | ZAP HTML reports from both runs + a PR where an injected high finding blocks merge | S1-20 |
| AC-002A-08 | Ring deploy + automatic rollback proven by injection test on dev | `deploy-dev.yml` run log showing 5% synthetic errors in Ring 0 → traffic reverted to previous revision in ≤2 min → incident auto-opened | S1-21 |
| AC-002A-09 | Branch protection and real CODEOWNERS enforced (screenshot + API evidence) | `gh api repos/Odingard/Sovereign/branches/main/protection` JSON + rendered CODEOWNERS with real handles + a screenshot of a blocked merge attempt | S1-20 |
| AC-002A-10 | STRIDE/DREAD threat model and residency matrix reviewed and signed | `docs/threat-model/*.md` (currently an empty directory) + `docs/DATA_RESIDENCY_MATRIX.md`, both with Michael's and Roger's sign-off lines | S1-23 |
| AC-002A-11 | k6 load report (2×/5×), chaos/DR drill with measured RTO/RPO, status page live, on-call and PIR approved | `docs/reports/load-2x-5x.md`, `docs/reports/dr-drill-01.md`, status page URL, `docs/runbooks/on-call.md`, `docs/runbooks/pir-template.md` (directory currently empty) | S1-24 |
| AC-002A-12 | Service Eligibility Matrix updated for every service touched | Diff to `docs/SERVICE_ELIGIBILITY_MATRIX.md` adding the rows in §9 below | S1-23 |

---

## 2. Repository validation

Commands run on `1b93aae`, local macOS (darwin 25.5.0), Node per `.nvmrc`, pnpm 10.33.0.

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | **PASS** (exit 0). Note this contradicts nothing in the repo, but CI does *not* use it — see below. |
| `pnpm run verify` | **FAIL** (exit 1) — PHI scanner, 4 findings |
| `pnpm run lint` | **FAIL** (exit 1) — Biome: 5 errors, 31 warnings |
| `pnpm run typecheck` | **FAIL** (exit 2) — 25 TypeScript errors |

**These are listed, not fixed.** Per the WO-002A scope boundary, only the `--frozen-lockfile` flag and the new-package boundary registration belong to S1-01.

### 2.1 `pnpm run verify` failure

```
✖ Prohibited data violations found:
  - [PHI PATTERN DETECTED] apps/marketing-site/.next/server/app/api/social-card/route.js: Matches US Phone Number in Data Context
  - [PHI PATTERN DETECTED] apps/marketing-site/.next/server/chunks/924.js
  - [PHI PATTERN DETECTED] apps/marketing-site/.next/static/chunks/89-aad8ce74d88aa48d.js
  - [PHI PATTERN DETECTED] apps/marketing-site/.next/static/chunks/polyfills-42372ed130431b0a.js
```

This is a **latent CI defect, not a local-only artifact.** `.next/` is correctly gitignored (`.gitignore:26` → `**/.next/`), but `scripts/verify-synthetic-data.ts:29` defines `IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".agents"])` — it walks the filesystem and does not consult `.gitignore`, and `.next` is not in the set. CI passes today only because `ci.yml` never runs a build before `pnpm run verify` (`.github/workflows/ci.yml:62-63`). **The moment S1-20/S1-21 adds a build step ahead of the verification step — which the deploy pipeline requires — the PHI gate starts false-failing on every run.** The false positive is a phone-number-shaped string in Next.js polyfills, not PHI.

I am flagging this rather than fixing it: the scanner is a WO-000 AC-06 control artifact (`work-orders/gate-records/WO-000-gate-record.md:34`), and widening its ignore list is a change to a PHI control. It needs Michael's review. Proposed fix in S1-01, one line, security-reviewed: add `.next`, `.turbo`, `coverage` to `IGNORE_DIRS`, and add a unit test asserting the scanner still catches a seeded synthetic pattern inside a non-ignored path.

### 2.2 `pnpm run lint` failure

Biome reports 5 errors / 31 warnings across 114 files. Sampled errors are `lint/suspicious/noExplicitAny` on migration signatures, e.g. `packages/persistence/src/migrations/001_initial_canonical_schema.ts:170` — `export async function down(db: Kysely<any>)`. This is the idiomatic Kysely migration signature; the correct resolution is a scoped `biome-ignore` with justification, not a type change. Not in WO-002A scope.

### 2.3 `pnpm run typecheck` failure

25 errors, all in `tests/`, in three families:

- `tests/architecture.test.ts:10-11` — TS5097, `.ts` import extensions without `allowImportingTsExtensions`.
- Domain-type drift: `ExtractionLineage` rejects `"SYNTHETIC_FIXTURE"`, `"RAW_FHIR_EXTRACT"`, `"RAW_INGESTION"`, `"SYNTHETIC_GENERATION"` (`tests/domain-clarifications.test.ts:56,80`; `tests/domain-invariants.test.ts:131,363`; `tests/persistence-postgres.test.ts:135`). `ExecutionNodeProps` has no `nodeType`; `ExternalExecutionAttempt` has no `attemptedAt`; `CompletionConfirmation` has no `confirmedAt`.
- Strict-null violations in `tests/persistence-postgres.test.ts` (possibly-undefined aggregates).

**This contradicts the WO-002 gate record.** `work-orders/gate-records/WO-002-gate-record.md:62-63` records *"TypeScript Typecheck (`pnpm run typecheck`): **PASS** (0 errors)"* and *"Biome Lint & Format: **PASS** (0 errors)"* at accepted commit `9db46d1`. Both now fail. The tests still *run* green under Vitest because Vitest transpiles without typechecking, so `pnpm run verify` never caught the regression — and neither did CI, because **`ci.yml` runs neither `lint` nor `typecheck`** (`.github/workflows/ci.yml:29-65`; the only quality step is `pnpm run verify` at line 63).

This matters directly to WO-002A: `docs/STAGE1_FOUNDATION_SPEC.md:453` requires `biome check` and `tsc --noEmit` in CI, and S1-01's exit criterion is "`pnpm run verify` green". Wiring those two commands in — which S1-01 must do — turns `main` red on day one. See §12 Q1 for the sequencing decision this forces.

### 2.4 Remote CI state on PR #4

PR #4 (`Odingard/Sovereign#4`, `mergeStateStatus: UNSTABLE`) has four failing checks. I inspected each:

| Check | Failure | Nature |
|---|---|---|
| SAST (Semgrep) | `Findings: 18 (18 blocking)`, `Ran 163 rules on 297 files` | Real findings, untriaged |
| SCA (pnpm audit + Trivy fs) | `Unable to resolve action 'aquasecurity/trivy-action@0.28.0', unable to find version '0.28.0'` | Broken pin at `.github/workflows/security-supply-chain.yml:62` — **the gate never executed** |
| IaC policy-as-code | `infra/policy/sovereign.rego:30: rego_unsafe_var_error: var _ is unsafe` | **The policy file does not compile** — the gate never executed |
| Architecture/Security/Synthetic Verification | `Lighthouse failed with exit code 1`, `CHROME_INTERSTITIAL_ERROR` on `http://127.0.0.1:4173/` | Marketing-site preview server not reachable; unrelated to this WO |

Two of these are the subject of this work order and are analyzed as findings, not incidental breakage, in §6.

---

## 3. Terraform module design

All modules live in `infra/modules/<name>/` with `main.tf`, `variables.tf`, `outputs.tf`, `README.md` stating enforced invariants, per `infra/modules/README.md:3`. Build order is fixed by `docs/STAGE1_FOUNDATION_SPEC.md:133-142`.

Notation: **Rego** column names the rule in `infra/policy/sovereign.rego` that *proves* the invariant. `NEW-n` = a rule this plan adds (§6). A "—" means the invariant has no machine proof and is review-enforced only; every one of those is called out.

### 3.1 `project`

- **Inputs:** `project_id`, `folder_id`, `billing_account`, `env`, `labels`
- **Outputs:** `project_id`, `project_number`, `enabled_apis`
- **Resources:** `google_project`, `google_project_service` (×N), `google_project_organization_policy` (×5), `google_essential_contacts_contact`
- **APIs enabled:** `compute`, `servicenetworking`, `sqladmin`, `cloudkms`, `storage`, `pubsub`, `secretmanager`, `run`, `artifactregistry`, `iam`, `iamcredentials`, `sts`, `cloudresourcemanager`, `monitoring`, `logging`, `cloudtrace`, `vpcaccess`, `identitytoolkit`, `binaryauthorization`, `cloudbuild` (only if Cloud Build is used — see §12 Q5)
- **Org policies applied** (all from `docs/STAGE1_FOUNDATION_SPEC.md:133`):

| Constraint | Value | Proves |
|---|---|---|
| `constraints/compute.vmExternalIpAccess` | deny all | AC-002A-02 no external IPs |
| `constraints/iam.disableServiceAccountKeyCreation` | enforced `true` | AC-002A-01 no SA keys |
| `constraints/gcp.resourceLocations` | `in:us-central1-locations` | AC-002A-02 region lock |
| `constraints/storage.uniformBucketLevelAccess` | enforced `true` | AC-002A-02 uniform access |
| `constraints/sql.restrictPublicIp` | enforced `true` | AC-002A-02 / AC-002A-03 |

| Invariant | Rego |
|---|---|
| No SA keys anywhere in the plan | R5 (`sovereign.rego:34-38`) |
| Every resource in `us-central1` | R6 (`sovereign.rego:40-48`) |
| All five org policies present and enforced | **NEW-1** |

> **Note on org-policy placement.** These constraints are set at *project* level here. Project-level policy can be removed by a project owner. The WO says "Service-account key creation disabled at org policy" (`work-orders/WO-002A-cloud-foundation-iac-cicd.md:40`) — organization or folder scope. Setting them at the folder is strictly stronger and matches "one folder with org policies" (`docs/STAGE1_FOUNDATION_SPEC.md:42`), but requires org-level IAM the Founder must hold. See §12 Q2 — **REQUIRES SECURITY DECISION**.

### 3.2 `network`

- **Inputs:** `project_id`, `subnet_cidr`, `connector_cidr`, `egress_allowlist` (list of `{host, ports, justification, approved_by}`)
- **Outputs:** `vpc_id`, `subnet_id`, `connector_id`, `psc_endpoint_ip`
- **Resources:** `google_compute_network` (auto-subnets off), `google_compute_subnetwork` (private Google access on, flow logs on), `google_vpc_access_connector`, `google_compute_router` + `google_compute_router_nat`, `google_compute_firewall` (egress deny-all at priority 65534 + allow rules per allowlist entry), `google_compute_global_address` + `google_service_networking_connection` for the Cloud SQL PSC path
- **APIs:** `compute`, `vpcaccess`, `servicenetworking`
- **Invariants:** deny-all egress with an explicit allowlist that is *data in the module* (`infra/modules/README.md:6`); no external IPs; flow logs enabled for the egress-denied alert in `monitoring`.

| Invariant | Rego |
|---|---|
| A default-deny egress firewall rule exists | **NEW-2** |
| No egress allow rule has destination `0.0.0.0/0` | **NEW-3** |
| Every allowlist entry carries a non-empty `justification` | **NEW-4** |
| Subnet has `private_ip_google_access = true` | **NEW-5** |

Stage 1 allowlist (`docs/STAGE1_FOUNDATION_SPEC.md:134`): `*.googleapis.com` (443), the Identity Platform tenant domain (443). Nothing else. Adding an entry is a security-reviewed PR.

### 3.3 `kms`

- **Inputs:** `project_id`, `env`, `protection_level` (`SOFTWARE` | `HSM`), `rotation_period`
- **Outputs:** `keyring_id`, `db_kek_id`, `gcs_kek_id`, `tenant_kek_id`
- **Resources:** `google_kms_key_ring` (`sovereign-<env>-kr`), 3 × `google_kms_crypto_key` (`db-kek`, `gcs-kek`, `tenant-kek`), `google_kms_crypto_key_iam_member` bindings
- **APIs:** `cloudkms`
- **Invariants:** 90-day rotation (`docs/STAGE1_FOUNDATION_SPEC.md:135`); `protection_level = HSM` in prod (`docs/STAGE1_FOUNDATION_SPEC.md:128`); **IAM separation — runtime service accounts receive `cloudkms.cryptoKeyEncrypterDecrypter` on `tenant-kek` only**, never on `db-kek` or `gcs-kek` (those are granted to the Cloud SQL and GCS service agents respectively).

| Invariant | Rego |
|---|---|
| `rotation_period` present and ≤ `7776000s` | **NEW-6** |
| prod keys are `protection_level = "HSM"` | **NEW-7** |
| No runtime SA holds encrypter/decrypter on `db-kek` or `gcs-kek` | **NEW-8** |

### 3.4 `cloudsql`

- **Inputs:** `project_id`, `env`, `tier`, `ha` (bool), `kms_key` (= `db-kek`), `private_network`, `backup_retention_days`, `pitr_days`
- **Outputs:** `instance_name`, `private_ip`, `connection_name`
- **Resources:** `google_sql_database_instance` (Postgres 16), `google_sql_database` (`sovereign`), `google_sql_user` (IAM type)
- **APIs:** `sqladmin`, `servicenetworking`
- **Settings** (`docs/STAGE1_FOUNDATION_SPEC.md:136`): `ipv4_enabled = false`, `private_network` set, `encryption_key_name = db-kek`, `cloudsql.iam_authentication = on`, `log_connections = on`, `log_disconnections = on`, `log_min_duration_statement = 1000`, `pgaudit.log = 'ddl,role'`, `require_ssl = true`. Environment shapes from `docs/STAGE1_FOUNDATION_SPEC.md:126`: dev `db-custom-2-8192` no HA; staging prod-shape + HA; prod HA + PITR 7d + backups 35d.

| Invariant | Rego |
|---|---|
| No public IP | R1 (`sovereign.rego:6-11`) |
| CMEK set | R2 (`sovereign.rego:13-18`) |
| `us-central1` | R6 |
| IAM auth database flag on | **NEW-9** |
| `require_ssl` / `ssl_mode` enforced | **NEW-10** |
| prod has `availability_type = REGIONAL` and PITR enabled | **NEW-11** |

> **Roles `sovereign_admin` / `sovereign_app` are NOT created by Terraform.** `docs/STAGE1_FOUNDATION_SPEC.md:136` lists them under the `cloudsql` module, but ADR-0009's dual-role model (`BYPASSRLS` vs `NOBYPASSRLS`) is Postgres-internal DDL, and putting role passwords or `ALTER ROLE` statements in Terraform state violates "no secrets in state" (`docs/SERVICE_ELIGIBILITY_MATRIX.md:47`). They are created by the first migration run as the Cloud SQL built-in admin, in `jobs/migrate`. **The module creates only the IAM-auth users.** This is a deliberate deviation from the spec's module boundary and is recorded in §12 Q3.

### 3.5 `gcs`

- **Inputs:** `project_id`, `env`, `kms_key` (= `gcs-kek`), `anchor_retention_years`
- **Outputs:** bucket names and URLs
- **Resources:** 4 × `google_storage_bucket` — `artifacts-<env>` (CMEK, versioning, per-tenant prefix convention), `audit-anchors-<env>` (CMEK, **`retention_policy { is_locked = true, retention_period = 7y }`**), `exports-<env>` (CMEK, 7-day lifecycle delete), `tfstate-<env>` (versioned, CMEK); plus `google_storage_bucket_iam_member` bindings
- **APIs:** `storage`

| Invariant | Rego |
|---|---|
| Uniform bucket-level access | R3 (`sovereign.rego:20-25`) |
| CMEK | R4 (`sovereign.rego:27-32`) — **currently broken, see §6.1** |
| `us-central1` | R6 |
| `audit-anchors-*` retention policy locked | **NEW-12** |
| No `allUsers` / `allAuthenticatedUsers` IAM member on any bucket | **NEW-13** |
| Versioning enabled on `tfstate-*` and `artifacts-*` | **NEW-14** |

> **Naming discrepancy.** The three environment roots pin the state bucket to `sovereign-tfstate-<env>` (`infra/envs/dev/main.tf:8`, `infra/envs/staging/main.tf:8`, `infra/envs/prod/main.tf:8`), while `docs/STAGE1_FOUNDATION_SPEC.md:137` and `infra/modules/README.md:9` call it `tfstate-<env>`. The roots win — a backend block cannot use variables, so the literal in the root is the real name. The module will emit `sovereign-tfstate-<env>` and I will correct the two docs. Also note the **chicken-and-egg**: the state bucket must exist before the root that would create it can initialize. It is therefore a Founder bootstrap step (§4), and the module manages it only via `terraform import` afterward, or not at all — see §12 Q6.

### 3.6 `pubsub`

- **Inputs:** `project_id`, `env`, `kms_key`, `topics` (list)
- **Outputs:** topic and subscription ids
- **Resources:** `google_pubsub_topic` × 3 (`domain-events`, `audit-events`, `metering-events`) each with `kms_key_name`; 3 × dead-letter topic; `google_pubsub_subscription` with `enable_message_ordering = true`, `dead_letter_policy`, `retry_policy`
- **APIs:** `pubsub`
- **Note:** ordering key is `tenant_id` (`docs/STAGE1_FOUNDATION_SPEC.md:138`) — that is a *publisher* attribute set in application code (WO-002C), not Terraform. The module only enables ordering on the subscription.

| Invariant | Rego |
|---|---|
| Every topic has `kms_key_name` | **NEW-15** |
| Every subscription has a `dead_letter_policy` | **NEW-16** |
| Message retention ≤ 7 days (`docs/SERVICE_ELIGIBILITY_MATRIX.md:36`) | **NEW-17** |

### 3.7 `iam`

- **Inputs:** `project_id`, `services` (list of service names), `github_repo` (`Odingard/Sovereign`)
- **Outputs:** service-account emails, `wif_provider_name`
- **Resources:** `google_service_account` per Cloud Run service/job, `google_project_iam_member` least-privilege bindings, `google_iam_workload_identity_pool`, `google_iam_workload_identity_pool_provider` (GitHub OIDC), `google_service_account_iam_member` (`roles/iam.workloadIdentityUser`)
- **APIs:** `iam`, `iamcredentials`, `sts`
- **Critical detail:** the WIF provider's attribute condition must pin **both** `assertion.repository == 'Odingard/Sovereign'` **and** the ref/environment. A provider mapped on `repository_owner` alone lets any repo in the org mint tokens for prod.

| Invariant | Rego |
|---|---|
| No `google_service_account_key` resource | R5 |
| WIF provider has a non-empty `attribute_condition` | **NEW-18** |
| WIF `attribute_condition` references `assertion.repository` (not just owner) | **NEW-19** |
| No SA holds a basic role (`roles/owner`, `roles/editor`, `roles/viewer`) | **NEW-20** |

### 3.8 `cloudrun-service`

- **Inputs:** `project_id`, `name`, `image`, `service_account`, `connector_id`, `ingress`, `min_instances`, `max_instances`, `secrets` (map), `env_vars`
- **Outputs:** `service_url`, `latest_revision`
- **Resources:** `google_cloud_run_v2_service`, `google_cloud_run_v2_service_iam_member`, `google_binary_authorization_policy` reference
- **APIs:** `run`, `vpcaccess`, `binaryauthorization`, `artifactregistry`
- **Defaults** (`docs/STAGE1_FOUNDATION_SPEC.md:140`): `ingress = INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`, `vpc_access { egress = ALL_TRAFFIC }`, binary authorization required, secrets mounted from Secret Manager (never env-var literals), non-root `run_as_user`, prod gateway `min_instances >= 1`.

| Invariant | Rego |
|---|---|
| Only `sovereign-gateway` may use `INGRESS_TRAFFIC_ALL` | R7 (`sovereign.rego:50-56`) |
| `vpc_access.egress == "ALL_TRAFFIC"` | **NEW-21** |
| Binary authorization enabled | **NEW-22** |
| Container runs non-root | **NEW-23** |
| No secret value in `env` (only `value_source.secret_key_ref`) | **NEW-24** |

### 3.9 `monitoring`

- **Inputs:** `project_id`, `env`, `notification_channels`, `slo_targets`
- **Outputs:** alert policy ids, SLO ids
- **Resources:** `google_monitoring_uptime_check_config`, `google_monitoring_service` + `google_monitoring_slo` (gateway availability 99.9%), `google_monitoring_alert_policy` × 8, `google_logging_metric` (for egress-denied and break-glass log-based metrics), `google_monitoring_notification_channel`
- **APIs:** `monitoring`, `logging`
- **Alert policies** (`docs/STAGE1_FOUNDATION_SPEC.md:141`): error rate; p95 latency > 2.5 s; Cloud SQL CPU/storage; outbox lag; audit-chain verification failure; egress-denied spike; break-glass activation; error-budget burn at 50%/90%.
- **Invariant:** the ring-rollback trigger in `deploy-*.yml` reads the *same* SLO objects this module creates — the pipeline must not define its own thresholds. Rego: **NEW-25** (every env root instantiates `monitoring`).

> Four of these eight alerts (outbox lag, audit-chain verification failure, break-glass activation, and the PHI-safe portion of error rate) fire on signals that **do not exist until WO-002C**. They will be created pointing at metric descriptors with no data, which in Cloud Monitoring is silently "no incidents" rather than an error. That is an acceptable but *dangerous-looking* green. Each such policy gets `documentation.content` stating "NO DATA EXPECTED UNTIL WO-002C" and is listed in the gate record so it is not mistaken for a passing control.

### 3.10 `secrets`

- **Inputs:** `project_id`, `secret_ids` (list), `kms_key`, `accessor_bindings`
- **Outputs:** secret ids and versions
- **Resources:** `google_secret_manager_secret` with `replication.user_managed` pinned to `us-central1` + CMEK, `google_secret_manager_secret_iam_member`
- **APIs:** `secretmanager`
- **Invariant:** **placeholders only — no `google_secret_manager_secret_version` with a real value is ever committed** (`docs/STAGE1_FOUNDATION_SPEC.md:142`, `infra/modules/README.md:14`). Values are set out-of-band by the Founder.

| Invariant | Rego |
|---|---|
| Replication is user-managed and pinned to `us-central1` (not automatic) | **NEW-26** |
| No `google_secret_manager_secret_version` resource in any plan | **NEW-27** |
| CMEK set on every secret | **NEW-28** |

---

## 4. Environment bootstrap sequence — Founder-only, one time, outside Terraform

Everything below requires either org-level authority, a legal signature, or credentials that must never exist in CI. **Everything not listed here is Terraform.** Steps run in order; each produces an artifact recorded in the gate record.

> Prerequisite: `gcloud` authenticated as the Founder with Organization Administrator, Folder Creator, Billing Account Administrator, and Project Creator.

**B-1 — Execute the Google Cloud BAA.** Console → Compliance → HIPAA. This is a legal act and gates everything else: `docs/SERVICE_ELIGIBILITY_MATRIX.md:33-45` holds every GCP service at `RESEARCH / NOT APPROVED FOR PHI` and `docs/ENTERPRISE_BUILD_PLAN.md:45` requires the BAA before any PHI. Evidence: executed BAA PDF reference (not the PDF) in the gate record. *No PHI follows from this — G0-B stays HOLD.*

**B-2 — Create the folder.**
```bash
gcloud resource-manager folders create \
  --display-name="sovereign" --organization="$ORG_ID"
export FOLDER_ID=$(gcloud resource-manager folders list \
  --organization="$ORG_ID" --filter="displayName=sovereign" --format="value(name)")
```

**B-3 — Create the three projects and link billing.**
```bash
for env in dev staging prod; do
  gcloud projects create "sovereign-$env" --folder="$FOLDER_ID"
  gcloud billing projects link "sovereign-$env" --billing-account="$BILLING_ACCOUNT_ID"
done
```

**B-4 — Set a budget and alert per project.** Not required by the WO; required by §11's cost finding. `gcloud billing budgets create` at the amount the Founder approves, alerting at 50/90/100%.

**B-5 — Enable the bootstrap APIs** (Terraform enables the rest):
```bash
for env in dev staging prod; do
  gcloud services enable cloudresourcemanager.googleapis.com \
    storage.googleapis.com cloudkms.googleapis.com iam.googleapis.com \
    iamcredentials.googleapis.com sts.googleapis.com --project="sovereign-$env"
done
```

**B-6 — Create the state buckets** (chicken-and-egg; see §3.5). One KMS keyring and key per project must precede the bucket so the bucket is CMEK from creation:
```bash
for env in dev staging prod; do
  P="sovereign-$env"
  gcloud kms keyrings create "sovereign-$env-bootstrap-kr" --location=us-central1 --project="$P"
  gcloud kms keys create tfstate-kek --location=us-central1 \
    --keyring="sovereign-$env-bootstrap-kr" --purpose=encryption \
    --rotation-period=90d --next-rotation-time="+90d" --project="$P"
  # grant the GCS service agent use of the key
  SA="service-$(gcloud projects describe $P --format='value(projectNumber)')@gs-project-accounts.iam.gserviceaccount.com"
  gcloud kms keys add-iam-policy-binding tfstate-kek --location=us-central1 \
    --keyring="sovereign-$env-bootstrap-kr" --project="$P" \
    --member="serviceAccount:$SA" --role=roles/cloudkms.cryptoKeyEncrypterDecrypter
  gcloud storage buckets create "gs://sovereign-tfstate-$env" \
    --project="$P" --location=us-central1 --uniform-bucket-level-access \
    --public-access-prevention \
    --default-encryption-key="projects/$P/locations/us-central1/keyRings/sovereign-$env-bootstrap-kr/cryptoKeys/tfstate-kek"
  gcloud storage buckets update "gs://sovereign-tfstate-$env" --versioning
done
```

**B-7 — Create the WIF pool and provider per project.** CI has no other way to authenticate; this cannot be created *by* CI.
```bash
for env in dev staging prod; do
  P="sovereign-$env"
  gcloud iam workload-identity-pools create github --location=global \
    --display-name="GitHub Actions" --project="$P"
  gcloud iam workload-identity-pools providers create-oidc github-provider \
    --location=global --workload-identity-pool=github \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='Odingard/Sovereign'" \
    --project="$P"
done
```
Terraform then manages the *bindings* (which SA each ref may impersonate) — the pool itself is imported or left unmanaged. The `prod` provider additionally pins `assertion.ref=='refs/heads/main'`.

**B-8 — Create the Terraform bootstrap service account per project** and bind it to the WIF provider with the minimum roles to run `plan`/`apply` (`roles/resourcemanager.projectIamAdmin`, `roles/compute.networkAdmin`, `roles/cloudsql.admin`, `roles/cloudkms.admin`, `roles/storage.admin`, `roles/pubsub.admin`, `roles/secretmanager.admin`, `roles/run.admin`, `roles/iam.serviceAccountAdmin`, `roles/monitoring.admin`). **No key is created** — org policy from B-9 forbids it and WIF makes it unnecessary.

**B-9 — Set folder-level org policies** *if* §12 Q2 is answered "folder scope":
```bash
for c in compute.vmExternalIpAccess iam.disableServiceAccountKeyCreation \
         storage.uniformBucketLevelAccess sql.restrictPublicIp; do
  gcloud resource-manager org-policies enable-enforce "constraints/$c" --folder="$FOLDER_ID"
done
gcloud resource-manager org-policies allow constraints/gcp.resourceLocations \
  in:us-central1-locations --folder="$FOLDER_ID"
```

**B-10 — Set GitHub environment secrets and variables.** Three GitHub Environments (`dev`, `staging`, `prod`), with `staging` and `prod` requiring reviewers.
```bash
for env in dev staging prod; do
  gh api -X PUT "repos/Odingard/Sovereign/environments/$env"
  gh variable set GCP_PROJECT_ID --env "$env" --body "sovereign-$env"
  gh variable set GCP_WIF_PROVIDER --env "$env" \
    --body "projects/$(gcloud projects describe sovereign-$env --format='value(projectNumber)')/locations/global/workloadIdentityPools/github/providers/github-provider"
  gh variable set GCP_TF_SERVICE_ACCOUNT --env "$env" --body "terraform@sovereign-$env.iam.gserviceaccount.com"
done
gh api -X PUT repos/Odingard/Sovereign/environments/prod \
  -f 'reviewers[][type]=User' -F 'reviewers[][id]='"$FOUNDER_USER_ID"
```
These are **variables, not secrets** — a WIF provider path is not a credential. No long-lived secret is set at all, which is the point of AC-002A-01.

**B-11 — Create the Identity Platform instance per project** (Console; no Terraform resource for the initial enablement) — dev and staging only at this stage. Prod at WO-002B. Status stays `RESEARCH / NOT APPROVED FOR PHI` per `docs/adr/ADR-0012-identity-provider-selection.md:15`.

**B-12 — Resolve the CODEOWNERS handles.** `CODEOWNERS:1-2` names Andre Byrd (`@andrebyrd-odingard`), Michael, Roger, Mark but lines 3-20 still reference unresolved team slugs (`@sovereign-health-ai/maintainers`, `/security`, `/architecture`, `/clinical-safety`, `/workflow`, `/qa`, `/privacy`). The Founder must create those GitHub teams and add the three reviewers, or replace the slugs with handles. **Branch protection cannot be enforced meaningfully until this is done** (AC-002A-09) — CODEOWNERS entries pointing at non-existent teams are silently ignored by GitHub, which means the "two reviews for `infra/`" rule at `CODEOWNERS:16` currently enforces nothing.

---

## 5. Pipeline design

### 5.1 Changes to `ci.yml`

| Line | Now | Change | Why |
|---|---|---|---|
| `.github/workflows/ci.yml:47` | `pnpm install --frozen-lockfile=false` | `--frozen-lockfile` | G-07 (`docs/GAP_REGISTER.md:13`), S1-01 exit criterion |
| after `:48` | — | add `pnpm run lint` and `pnpm run typecheck` steps | `docs/STAGE1_FOUNDATION_SPEC.md:453` requires `biome check` + `tsc --noEmit`; both currently fail (§2.2, §2.3) — **blocked on §12 Q1** |
| `:14-27` | postgres service | keep; add a Pub/Sub emulator service for S1-15 (WO-002C, not this WO) | — |
| `:62-63` | `pnpm run verify` | unchanged, but the PHI scanner needs the `.next` fix first (§2.1) | prevents a false-fail once a build step lands |

### 5.2 Changes to `security-supply-chain.yml`

| Line | Defect | Fix |
|---|---|---|
| `:62` | `aquasecurity/trivy-action@0.28.0` does not exist — gate never ran | pin to a released tag by **SHA**, not a floating version |
| `:87` | `conftest test infra/envs/$env` runs against **`.tf` source**, while `infra/policy/sovereign.rego:7` reads `input.resource_changes` — a field that exists only in `terraform show -json` plan output | replace with: `terraform plan -out=tfplan && terraform show -json tfplan > plan.json && conftest test plan.json`. See §6.2 — **this is the single most important finding in this plan.** |
| `:91-94` | `sbom-provenance` has `needs: [sast, sca, iac]`, so it is SKIPPED whenever any gate fails, and `attest-build-provenance` is gated on `github.event_name != 'pull_request'` | keep the `needs` (correct — do not sign unscanned code), but make the skip *visible*: a skipped required check must not read as green |
| `:114-136` | DAST job ends `echo "::warning::..." && exit 0` when `PREVIEW_URL` is unset — **the gate is unconditionally green and has never tested anything** | build the ephemeral preview in a new `deploy-preview.yml`, publish its URL, and make a missing URL a **hard failure** once AC-002A-07 lands |
| — | no container scan, no cosign, no SLSA on an image | add after an image exists: `trivy image`, `cosign sign --yes` keyless via WIF, `actions/attest-build-provenance` on the image digest |
| — | no CycloneDX **and** SPDX on the *image* (only the repo, `:97-107`) | AC-002A-06 says "on a tagged build" — add image SBOMs |

### 5.3 New `deploy-dev.yml`

Trigger: push to `main`. Environment: `dev`.

```
auth (WIF)
  → build image, tag with $GITHUB_SHA
  → push to Artifact Registry us-central1-docker.pkg.dev/sovereign-dev/sovereign
  → cosign sign + attest (SLSA provenance on digest)
  → trivy image --severity HIGH,CRITICAL --exit-code 1
  → binary authorization attestation
  → run Cloud Run Job `migrate` (sovereign_admin creds from Secret Manager)
  → deploy new revision with --no-traffic
  → RINGS (see 5.4)
  → adversarial suite vs dev   [tests/adversarial — WO-002B/C deliver the tests; this WO delivers the hook]
  → on pass: dispatch deploy-staging.yml
```

### 5.4 Ring mechanics on Cloud Run

Rings per `docs/STAGE1_FOUNDATION_SPEC.md:59` (S1-D18): internal canary → 1% → 10% → 50% → 100%, **≥15 min each** in dev/staging, **≥1 h each** in prod (`docs/ENTERPRISE_BUILD_PLAN.md:120`).

Traffic is shifted with:
```bash
gcloud run services update-traffic sovereign-gateway \
  --region=us-central1 --to-revisions="$NEW=$PCT,$PREV=$((100-PCT))"
```

The "internal canary" ring is *not* a traffic percentage — it is a tagged revision reachable only at its tag URL, smoke-tested by the workflow before any production traffic is split:
```bash
gcloud run services update-traffic sovereign-gateway --region=us-central1 \
  --set-tags="canary=$NEW" --to-revisions="$PREV=100"
curl -fsS "https://canary---$SERVICE_URL/health/ready"
```

**Hold-and-evaluate loop per ring.** After each shift, the workflow sleeps the hold time, then queries Cloud Monitoring for the window:

- **SLO burn:** error-budget burn rate over the ring window against the `monitoring` module's 99.9% availability SLO. Rollback if the 15-min burn rate > 14.4 (the standard fast-burn threshold — 2% of a 30-day budget in 1 h).
- **P99 latency:** `run.googleapis.com/request_latencies` 99th percentile for the new revision only, compared against the previous revision's same-window baseline. Rollback if P99 > 800 ms for transactional APIs (`docs/ENTERPRISE_BUILD_PLAN.md:40`) **or** > 1.5× baseline, whichever is tighter.
- **Error rate:** 5xx ratio on the new revision > 1%.

Both thresholds read the SLO objects created by the `monitoring` module — the pipeline never hardcodes them (§3.9).

**Rollback** (`docs/STAGE1_FOUNDATION_SPEC.md:466`):
```bash
gcloud run services update-traffic sovereign-gateway \
  --region=us-central1 --to-revisions="$PREV=100"
```
Target ≤2 min from detection (AC-002A-08). The workflow then opens a GitHub issue labeled `incident,auto-opened` with the ring, the metric that tripped, and the revision digests.

**Injection test for AC-002A-08:** the hello service gets a `SOVEREIGN_FAULT_INJECT_PCT` env var (dev only, rejected by policy in staging/prod — **NEW-29**). Setting it to `5` in Ring 0 must produce automatic rollback within 2 min and an auto-opened incident. That run log is the evidence.

### 5.5 `deploy-staging.yml` / `deploy-prod.yml`

- **staging**: dispatched by `deploy-dev.yml` on adversarial-suite pass; same ring mechanics; GitHub Environment `staging` with one required reviewer.
- **prod**: `workflow_dispatch` only, GitHub Environment `prod` requiring **two reviewers, one of whom is a security CODEOWNER** (`work-orders/WO-002A-cloud-foundation-iac-cicd.md:25`). GitHub environment protection cannot express "one must be a security CODEOWNER" natively — it enforces a reviewer count from a list. The CODEOWNER requirement is enforced at the PR level by branch protection on `infra/` and `.github/`; the environment reviewer list is set to exactly {Andre, Michael} so that two approvals necessarily include Michael. **This is a construction, not a native guarantee** — noted in §12 Q7.
- Prod ring holds are ≥1 h. Prod deploys are blocked entirely while G0-B is HOLD for anything beyond synthetic smoke traffic.

### 5.6 Required checks on `main`

| Check | Source | Required |
|---|---|---|
| `Architecture, Security & Synthetic Verification` | ci.yml | yes |
| `lint` | ci.yml (new) | yes — after §12 Q1 |
| `typecheck` | ci.yml (new) | yes — after §12 Q1 |
| `SAST (Semgrep)` | security-supply-chain.yml | yes |
| `SCA (pnpm audit + Trivy fs)` | security-supply-chain.yml | yes |
| `IaC policy-as-code (Checkov + Conftest)` | security-supply-chain.yml | yes |
| `SBOM + signed provenance` | security-supply-chain.yml | yes |
| `DAST (ZAP baseline)` | security-supply-chain.yml | yes — after AC-002A-07 |
| `terraform plan (dev/staging/prod)` | new `terraform-plan.yml` | yes |
| `conftest negative tests` | new job | yes |

### 5.7 Branch protection and its evidence

```bash
gh api -X PUT repos/Odingard/Sovereign/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": [ ...the ten above... ] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "required_linear_history": true,
  "required_signatures": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "restrictions": null
}
JSON
```

`"enforce_admins": true` is what satisfies "a failing gate cannot be bypassed by label or admin merge" (`work-orders/WO-002A-cloud-foundation-iac-cicd.md:42`) — **including by the Founder.** The two-review rule for `infra/`, `packages/crypto`, `packages/kernel`, `.github/`, `docs/adr/` comes from CODEOWNERS (`CODEOWNERS:16-20`) combined with `require_code_owner_reviews`, and is only real once B-12 resolves the team slugs.

Evidence for AC-002A-09: `gh api repos/Odingard/Sovereign/branches/main/protection` output, `gh api .../required_signatures`, a screenshot of a blocked merge, and a screenshot of an admin merge being refused.

---

## 6. Policy-as-code

### 6.1 Finding: `sovereign.rego` does not compile

`infra/policy/sovereign.rego:27-32`:
```rego
deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_storage_bucket"
  not rc.change.after.encryption[_].default_kms_key_name   # line 30
  msg := sprintf("Bucket %s must use CMEK", [rc.address])
}
```
`_` inside a negated expression is unsafe — OPA cannot bind it. Conftest reports `rego_unsafe_var_error: var _ is unsafe` and **refuses to load the entire policy file**, so *all seven* rules are dead, not just this one. Fix:
```rego
deny[msg] {
  rc := input.resource_changes[_]
  rc.type == "google_storage_bucket"
  not bucket_has_cmek(rc)
  msg := sprintf("Bucket %s must use CMEK", [rc.address])
}

bucket_has_cmek(rc) {
  rc.change.after.encryption[_].default_kms_key_name != ""
}
```

### 6.2 Finding: the Conftest gate evaluates the wrong input

Even compiled, the gate proves nothing. `.github/workflows/security-supply-chain.yml:87` runs `conftest test infra/envs/$env` — i.e. against the **HCL source files**. Every rule in `sovereign.rego` begins `input.resource_changes[_]` (line 7, 14, 21, 28, 35, 41, 51), which exists only in `terraform show -json <plan>` output. Conftest parses `.tf` into a completely different shape, `resource_changes` is undefined, every `deny` body fails, and the gate exits **0 — passing**.

So today's IaC gate is a rule set that cannot load, evaluating a document it cannot match, and reporting success. AC-002A-05 requires the opposite: *"Conftest/Checkov gates fail a deliberately non-compliant plan."* The fix is in §5.2: generate plan JSON, run Conftest against that.

This also explains why the three skeleton roots (`infra/envs/*/main.tf`, 24 lines each, zero resources) have never produced a policy signal.

### 6.3 Rules to add

The 29 `NEW-n` rules referenced in §3 and §5.4, grouped:

- **Org policy** (NEW-1) — all five constraints present and enforced
- **Network** (NEW-2…5) — default-deny egress, no `0.0.0.0/0` allow, justification required, private Google access
- **KMS** (NEW-6…8) — rotation ≤ 90 d, HSM in prod, no runtime SA on `db-kek`/`gcs-kek`
- **Cloud SQL** (NEW-9…11) — IAM auth, SSL required, prod regional + PITR
- **GCS** (NEW-12…14) — anchor retention locked, no public IAM member, versioning
- **Pub/Sub** (NEW-15…17) — CMEK, DLQ, retention ≤ 7 d
- **IAM/WIF** (NEW-18…20) — attribute condition present, repo-pinned, no basic roles
- **Cloud Run** (NEW-21…24) — VPC egress all, binary authz, non-root, no inline secrets
- **Monitoring** (NEW-25) — every root instantiates it
- **Secrets** (NEW-26…28) — user-managed replication in `us-central1`, no committed versions, CMEK
- **Pipeline** (NEW-29) — no fault-injection env var outside dev

### 6.4 Negative test plan

Two layers, both required on `main`.

**Layer 1 — Rego unit tests** (`infra/policy/sovereign_test.rego`), run by `conftest verify`. Fast, no cloud, no Terraform. Each rule gets a passing and a failing fixture:
```rego
test_denies_public_cloudsql {
  count(deny) == 1 with input as {"resource_changes": [{
    "address": "module.cloudsql.google_sql_database_instance.main",
    "type": "google_sql_database_instance",
    "change": {"after": {"settings": [{"ip_configuration": [{"ipv4_enabled": true}]}]}}
  }]}
}

test_allows_private_cloudsql {
  count(deny) == 0 with input as { ... "ipv4_enabled": false, "encryption_key_name": "…" ... }
}
```
36 rules × 2 = 72 unit tests. This layer is what makes a rule regression impossible to merge, and it is the only layer that runs in seconds.

**Layer 2 — Real non-compliant plans** (`infra/policy/negative/`), which is what AC-002A-05 literally asks for. Each fixture is a minimal Terraform root that plans *successfully* but violates exactly one invariant:

| Fixture | Violates | Must be caught by |
|---|---|---|
| `public-cloudsql/` | `ipv4_enabled = true` | R1 |
| `no-cmek-cloudsql/` | no `encryption_key_name` | R2 |
| `legacy-acl-bucket/` | `uniform_bucket_level_access = false` | R3 |
| `no-cmek-bucket/` | no default KMS key | R4 (the rule fixed in 6.1) |
| `sa-key/` | `google_service_account_key` | R5 |
| `wrong-region/` | `location = "us-east1"` | R6 |
| `public-cloudrun/` | `INGRESS_TRAFFIC_ALL` on a non-gateway service | R7 |
| `open-egress/` | egress allow to `0.0.0.0/0` | NEW-3 |
| `unlocked-anchors/` | `is_locked = false` | NEW-12 |
| `public-bucket-iam/` | `allUsers` member | NEW-13 |
| `wif-owner-only/` | condition on `repository_owner` only | NEW-19 |
| `inline-secret/` | literal secret in Cloud Run `env` | NEW-24 |
| `committed-secret-version/` | `google_secret_manager_secret_version` present | NEW-27 |

CI job:
```bash
for d in infra/policy/negative/*/; do
  terraform -chdir="$d" init -backend=false
  terraform -chdir="$d" plan -out=tfplan -refresh=false
  terraform -chdir="$d" show -json tfplan > "$d/plan.json"
  if conftest test "$d/plan.json" --policy infra/policy --all-namespaces; then
    echo "::error::NEGATIVE TEST FAILED TO FAIL: $d"; exit 1
  fi
done
```
The inverted exit code is the point: **a gate that cannot fail is not a gate**, which is exactly the defect found in §6.2 and in the DAST job at `.github/workflows/security-supply-chain.yml:136`.

These fixtures never run `apply` and have no backend; `plan -refresh=false` against the Google provider needs no credentials for the resource shapes used.

---

## 7. Threat model and residency matrix

Both directories exist and are **empty**: `docs/threat-model/` and `docs/runbooks/` contain no tracked files (`git ls-files` returns nothing for either).

### 7.1 `docs/threat-model/`

Expands the one-page `docs/THREAT_MODEL.md` (18 lines), whose asset list (`:5`), adversary list (`:9`), mitigation list (`:13`) and abuse cases (`:17`) become the seed rows. Structure:

```
docs/threat-model/
├── README.md                    # method, DREAD scale definition, review log, sign-off block
├── TB-01-internet-to-gateway.md
├── TB-02-gateway-to-services.md
├── TB-03-service-to-database.md
├── TB-04-service-to-kms.md
├── TB-05-service-to-pubsub.md
├── TB-06-ci-to-cloud.md         # WIF, supply chain — the boundary WO-002A creates
├── TB-07-idp-to-sovereign.md
├── TB-08-operator-to-prod.md    # JIT/PAM, break-glass
└── TB-09-tenant-to-tenant.md    # the pool-model boundary; ADR-0009
```

Each file: a diagram of the boundary, then a STRIDE table (Spoofing / Tampering / Repudiation / Information disclosure / Denial of service / Elevation of privilege), each threat carrying an ID, the affected asset, the existing control with a file citation, residual risk, and a DREAD score.

DREAD scoring (1–10 per axis, documented in the README so scores are reproducible rather than vibes): Damage, Reproducibility, Exploitability, Affected users, Discoverability. Risk = mean. ≥7 blocks Gate 1; 4–6.9 needs an accepted-risk entry signed by Michael; <4 is tracked.

WO-002A owns **TB-06** end to end (it is the boundary this work order builds) and produces first-pass content for the rest. TB-01, TB-02, TB-07 depend on WO-002B; TB-03/04/05 on WO-002C. Those sections will be marked `PROVISIONAL — depends on WO-002B/C` rather than guessed at.

### 7.2 `docs/DATA_RESIDENCY_MATRIX.md`

Columns: data category → storage service → region → replication scope → encryption (CMEK key + per-tenant DEK) → subprocessor → BAA status → retention class → cross-border transfer (all "none"). Rows for every store the ten modules create, plus GitHub (source and CI logs, no PHI, no BAA — `docs/SERVICE_ELIGIBILITY_MATRIX.md:46`) and Identity Platform (authentication records only).

Two facts to state explicitly because they are residency exceptions the matrix must not hide:

- **Cloud SQL's eligibility row says "US multi-region / dual-region"** (`docs/SERVICE_ELIGIBILITY_MATRIX.md:33`) while S1-D15 locks everything to `us-central1` (`docs/STAGE1_FOUNDATION_SPEC.md:56`). Automated backups follow the instance region, but the *default* backup location for a `us-central1` instance is the `us` multi-region. The matrix must record `backup_location = us-central1` explicitly, and the `cloudsql` module must set it — otherwise backups silently leave the locked region. This is a real residency leak, caught by NEW-11's extension rather than by the org policy (`gcp.resourceLocations` does not constrain backup location in all cases).
- **Cloud Logging's `_Default` bucket is regional but `_Required` is not configurable.** Log data classified non-PHI by ADR-0007 §5 (`docs/adr/ADR-0007-...md`, "Telemetry & Log Isolation"), so this is acceptable — but it must be *written down* as an accepted exception, not omitted.

Sign-off block for Michael (security) and Roger (architecture) per AC-002A-10.

---

## 8. Load, chaos, DR, status page, on-call, PIR

### 8.1 Assumed pilot load — stated because nothing in the repo defines it

No document in the repository states a pilot load figure. `docs/ENTERPRISE_BUILD_PLAN.md:36` gives a *rate limit* (50 rps/tenant, burst 200), which is a ceiling, not a forecast. I am therefore assuming, explicitly, and asking for correction in §12 Q8:

> **Assumed pilot: 2 design-partner practices, 10 concurrent clinical users each, 8 requests/user/minute during a 4-hour clinic block = ~2.7 rps sustained, ~8 rps peak.**

- **2× load** = 5.4 rps sustained / 16 rps peak
- **5× load** = 13.5 rps sustained / 40 rps peak

These are small numbers. That is the honest consequence of a two-practice pilot, and sizing infrastructure for them is the point of running the test rather than assuming.

### 8.2 k6 scenarios — `tests/load/`

Two synthetic tenants (A, B) per AC-002A-11, seeded with synthetic data only.

| Scenario | Shape | Asserts |
|---|---|---|
| `smoke.js` | 1 VU, 1 min | pipeline wiring |
| `steady-2x.js` | ramp to 5.4 rps, hold 30 min, both tenants | P95 ≤ 2.5 s, P99 ≤ 800 ms, 0 5xx, 0 cross-tenant rows |
| `steady-5x.js` | ramp to 13.5 rps, hold 30 min | same, plus Cloud SQL connections < pool max |
| `peak-burst.js` | 40 rps for 5 min | autoscale triggers, no cold-start P99 blowout |
| `pool-exhaustion.js` | drive past the connection pool deliberately | fails *closed* with 503, never with a cross-tenant leak or a 200 carrying wrong data |
| `rate-limit.js` | one tenant exceeds 50 rps | that tenant is throttled, the **other tenant is unaffected** (noisy-neighbor proof, `docs/ENTERPRISE_BUILD_PLAN.md:36`) |

In Stage 1 the only deployed surface is the hello service and `/health/*`. Scenarios that require real endpoints are written now and **gated on WO-002B** — the report will state which ran and which were deferred rather than implying full coverage.

### 8.3 Chaos/DR drill scripts — `scripts/drills/`

Per S1-D24 (`docs/STAGE1_FOUNDATION_SPEC.md:65`) and the WO (`:29`). All on dev.

| Drill | Method | Expected | Measures |
|---|---|---|---|
| `cloudsql-failover.sh` | `gcloud sql instances failover` | reconnect without data loss | RTO, RPO |
| `kms-unavailable.sh` | remove the service SA's `cryptoKeyEncrypterDecrypter` on `tenant-kek` for 10 min | **fail closed** — PHI paths 503, non-PHI continues (`docs/STAGE1_FOUNDATION_SPEC.md:507`) | detection time, correct failure mode |
| `pubsub-backlog.sh` | pause the subscription, publish 100k messages, resume | drains, no loss, DLQ empty | drain rate, lag peak |
| `idp-outage.sh` | block the IdP domain in the egress allowlist | existing sessions live to expiry, new logins blocked, truthful banner | degraded-mode correctness |
| `dr-restore.sh` | PITR restore to a **scratch instance**, checksum-compare | byte-identical | **RTO, RPO vs NFR-002** |

**RTO/RPO measurement against NFR-002** (RTO ≤ 4 h, RPO ≤ 15 min, `docs/ENTERPRISE_BUILD_PLAN.md:41` — "measured by drill, not asserted"):
- **RPO** = (timestamp of last row present in the restored copy) − (timestamp of the last row written before the simulated loss). Measured by a writer process stamping a monotonic sequence into a synthetic table at 1 Hz throughout the drill. The gap in that sequence *is* the RPO. No estimation.
- **RTO** = wall clock from `T0` (fault injected) to `T1` (restored instance serving a successful synthetic read), timestamped by the drill script, not by a human.

Report: `docs/reports/dr-drill-01.md` with raw timestamps, the measured numbers, pass/fail against NFR-002, and every deviation.

### 8.4 Status page

Constraint: bootstrapped budget (`docs/adr/ADR-0012-identity-provider-selection.md:7`), private in Stage 1, public at GA (S1-D25, `docs/STAGE1_FOUNDATION_SPEC.md:66`).

**Recommendation: Better Stack (Better Uptime) free tier** — one status page, password-protectable, 10 monitors, 3-minute checks, $0. Alternatives considered: Atlassian Statuspage (~$29/mo for the cheapest tier that allows private pages), Instatus (free tier public-only; private starts ~$20/mo), self-hosted Gatus on Cloud Run (~$0 but adds an operated component, and a status page that shares infrastructure with the thing it monitors is a bad status page).

Components: Gateway, Identity, Patient Context, Audit, Database, Async Processing. All read from external uptime checks, **not** from inside the VPC — so the page survives the outage it is reporting.

*The status page holds no PHI and no tenant names.* It stays `APPROVED FOR SYNTHETIC USE ONLY` in the eligibility matrix (§9).

### 8.5 On-call — `docs/runbooks/on-call.md`

Tiers per S1-D25 / `docs/ENTERPRISE_BUILD_PLAN.md:122`: **T1** founder/on-call developer (ack ≤15 min Sev1), **T2** contract developer (deep system), **T3** vendor (GCP support, Identity Platform, model provider). Document covers: severity definitions (Sev1 = PHI exposure risk, clinical-safety impact, or full outage), the escalation ladder with times, the incident-bridge procedure, and the handoff checklist.

**Honest constraint to record in the document:** at pilot scale the T1 rotation is one person. A one-person rotation is not a rotation — it is a single point of failure with a pager. The document will say so plainly and name it as a Gate 4 risk rather than describing an on-call program that does not exist.

### 8.6 `docs/runbooks/pir-template.md`

Sections: incident ID and severity; timeline with UTC timestamps; detection (how, and how long it took); impact (tenants, patients, data — synthetic or real); root cause (blameless, 5-whys); what went well; what did not; contributing factors; corrective actions with owners and dates; and a **HIPAA breach-assessment determination** hook into `docs/INCIDENT_RESPONSE_PLAN.md`. Due within 5 business days of any Sev1/Sev2 (`docs/ENTERPRISE_BUILD_PLAN.md:122`).

---

## 9. Service Eligibility Matrix updates

Every service this WO touches, and its resulting status. Nothing is promoted to `CONDITIONALLY APPROVED FOR PRODUCTION PHI` by this work order — promotion requires the §53-59 workflow and Founder + Security sign-off (`docs/SERVICE_ELIGIBILITY_MATRIX.md:59`), and the GCP BAA (B-1) is a precondition.

**Existing rows — status unchanged, configuration column updated to cite the enforcing module:**

| Service | Row | Change |
|---|---|---|
| Cloud SQL for PostgreSQL | `:33` | add: enforced by `infra/modules/cloudsql`; record `backup_location = us-central1` (§7.2) |
| Cloud Run | `:34` | add: enforced by `infra/modules/cloudrun-service`; binary authz, non-root, internal ingress |
| Secret Manager | `:35` | add: user-managed replication `us-central1`; placeholders only, values out-of-band |
| Pub/Sub | `:36` | add: CMEK + DLQ enforced by `infra/modules/pubsub` |
| Cloud Logging / Monitoring | `:40` | add: `_Required` bucket region exception recorded in the residency matrix |
| Identity Platform | `:41` | unchanged — `RESEARCH`; dev/staging instances created at B-11, synthetic only |
| Cloud KMS / EKM | `:44` | add: `db-kek`/`gcs-kek`/`tenant-kek`, 90-day rotation, HSM in prod, IAM separation |
| Cloud Storage | `:45` | add: four buckets; `audit-anchors-*` retention locked 7 y |
| GitHub (repo, Actions, WIF) | `:46` | add: WIF only, no SA keys, repo-pinned attribute condition |
| Terraform state (GCS backend) | `:47` | add: `sovereign-tfstate-<env>`, versioned, CMEK via bootstrap keyring |
| Security CI tooling | `:49` | add Conftest negative-test fixtures; note Trivy pin must be by SHA |

**New rows to add:**

| Category | Service | Proposed status | Rationale |
|---|---|---|---|
| CI/CD | Google Artifact Registry | `RESEARCH / NOT APPROVED FOR PHI` | GCP BAA covered; holds images, never PHI; CMEK, `us-central1`, immutable tags |
| Networking | Cloud NAT / Cloud Router | `RESEARCH / NOT APPROVED FOR PHI` | GCP BAA covered; egress path; flow logs feed the egress-denied alert |
| Networking | Serverless VPC Access connector | `RESEARCH / NOT APPROVED FOR PHI` | GCP BAA covered; carries PHI in transit inside the VPC |
| Security | Binary Authorization | `RESEARCH / NOT APPROVED FOR PHI` | GCP BAA covered; metadata only |
| Supply chain | Sigstore / Fulcio / Rekor (cosign keyless) | **Needs a decision** | Keyless signing publishes the certificate and an entry to the **public** Rekor transparency log. The entry contains the repo identity and commit SHA — no PHI, but it is a permanent public disclosure of build metadata. See §12 Q9 — **REQUIRES SECURITY DECISION** |
| Operations | Better Stack (status page) | `APPROVED FOR SYNTHETIC USE ONLY` | No PHI, no tenant identifiers; external monitoring only; free tier |
| Testing | k6 (local/CI binary) | `APPROVED FOR SYNTHETIC USE ONLY` | Runs in CI against synthetic tenants; no cloud service, no data retention |
| Observability | Cloud Trace | `RESEARCH / NOT APPROVED FOR PHI` | GCP BAA covered; span attributes must carry `tenant_id` but never PHI (WO-002C enforces) |

---

## 10. Ticket sequence

One PR per ticket. No PR exceeds its ticket's scope. Estimates are for one engineer, and separate *build* from *wait* (ring holds and drills are wall-clock, not effort).

| # | Ticket | Scope | Depends on | Est. | PR |
|---|---|---|---|---|---|
| 1 | **S1-01** | `packages/{kernel,crypto,telemetry}` scaffolds registered in `scripts/verify-architecture.ts`; `--frozen-lockfile` at `ci.yml:47`; PHI-scanner `.next` fix (§2.1); `lint`+`typecheck` wired per §12 Q1 | — | 1–2 d | PR-A |
| 2 | **S1-02** | Modules `project`, `network`, `kms`, `secrets`, `iam` + WIF; dev root wired; `terraform-plan.yml` | S1-01, B-1…B-10 | 4–6 d | PR-B |
| 3 | **S1-03** | Modules `cloudsql`, `gcs`, `pubsub`, `monitoring`; dev root complete; hello service proving private connectivity and egress deny | S1-02 | 4–5 d | PR-C |
| 4 | **S1-20** | Fix `sovereign.rego:30`; switch Conftest to plan JSON; Trivy SHA pin; 29 new rules; 72 rego unit tests; 13 negative fixtures; container scan, cosign, SLSA, image SBOMs; DAST hard-fail; branch protection | S1-03 | 5–7 d | PR-D |
| 5 | **S1-21** | `deploy-dev.yml`, `deploy-staging.yml`, `deploy-prod.yml`; migration job; ring mechanics; rollback; fault injection proving AC-002A-08 | S1-20 | 4–6 d + hold time | PR-E |
| 6 | **S1-02b / S1-03b** | staging + prod roots from the proven modules | S1-21 | 2–3 d | PR-F |
| 7 | **S1-23** | `docs/threat-model/` (9 boundaries), `docs/DATA_RESIDENCY_MATRIX.md`, eligibility matrix updates | S1-03 (can run parallel to S1-20/21) | 3–4 d | PR-G |
| 8 | **S1-24** | k6 scenarios, drill scripts, DR drill execution, status page, on-call doc, PIR template | S1-21, PR-F | 3–4 d + drill time | PR-H |
| 9 | — | `work-orders/gate-records/WO-002A-gate-record.md` assembling all evidence | all | 1 d | PR-I |

**Critical path:** S1-01 → S1-02 → S1-03 → S1-20 → S1-21 → PR-F → S1-24. Roughly **24–34 working days** of build, plus ring hold time and drill windows. S1-23 (PR-G) parallelizes off S1-03.

Tickets not in this WO, listed so the boundary is explicit: S1-04…S1-19, S1-22, S1-25 belong to WO-002B/WO-002C or Gate 1 close-out. S1-22 (the adversarial suite) is **depended on** by `deploy-dev.yml` but **not built here** — PR-E ships the hook and a passing stub, and the gate record will say so.

---

## 11. Cost estimate

Assumptions, stated so they can be corrected: `us-central1` on-demand list pricing, no CUDs or sustained-use discounts modeled; the pilot load in §8.1; 24×7 Cloud SQL (it is not stopped outside hours); dev Cloud Run scaling to zero; ~20 GB database; < 10 GB/month egress; < 50 GiB/month logs (within the free allotment). **Prices are list rates as I understand them and are not a quote** — the Founder should confirm against the GCP pricing calculator before committing.

| Line item | dev | staging | prod |
|---|---|---|---|
| Cloud SQL compute (2 vCPU / 8 GB) | ~$101 | ~$101 | ~$101 |
| Cloud SQL HA (regional, ×2) | — | ~$101 | ~$101 |
| Cloud SQL storage + backups | ~$5 | ~$12 | ~$20 |
| Serverless VPC connector (2 × e2-micro min) | ~$18 | ~$18 | ~$18 |
| Cloud NAT gateway + processing | ~$33 | ~$33 | ~$35 |
| Cloud Run | ~$0 (scales to zero) | ~$5 | ~$25 (gateway min 1) |
| Cloud KMS (3 keys, 90-day rotation) | ~$1 | ~$1 | ~$8 (HSM) |
| GCS (4 buckets, low volume) | ~$2 | ~$3 | ~$5 |
| Pub/Sub | ~$0 (free tier) | ~$1 | ~$2 |
| Secret Manager | ~$1 | ~$1 | ~$1 |
| Artifact Registry | ~$2 | ~$2 | ~$2 |
| Monitoring / Logging / Trace | ~$0 | ~$3 | ~$10 |
| Identity Platform | ~$0 | ~$0 | see below |
| **Estimated monthly total** | **~$163** | **~$281** | **~$328** |

**Combined: ~$772/month across three environments.**

### Items above the $150/month/environment threshold — Founder decision required

**All three environments exceed it.** The driver is the same in each: **Cloud SQL plus the always-on network path (connector + NAT) is ~$152/month before anything else runs.** That floor exists whether or not a single request is served.

Options, in the order I would consider them — none taken without a Founder decision:

1. **Shrink dev's database.** `db-f1-micro` or `db-g1-small` instead of `db-custom-2-8192` cuts dev by ~$85/month. Cost: dev stops being shape-comparable to staging, so a performance regression that only appears under the real shape will not surface until staging. Acceptable for Stage 1, where dev carries no load.
2. **Stop the dev Cloud SQL instance outside working hours.** A scheduled `gcloud sql instances patch --no-activation-policy` saves roughly 60% of dev compute (~$60/month). Cost: a cron that can fail open (instance left running) or closed (CI fails at 2 a.m.). Adds an operated component.
3. **Defer the prod project until WO-002B.** Prod has nothing to run during WO-002A — AC-002A-08 is proven on dev (`work-orders/WO-002A-cloud-foundation-iac-cicd.md:63`, "proven by injection test on dev") and S1-D18 says rings are "proven on dev before prod exists" (`docs/STAGE1_FOUNDATION_SPEC.md:59`). Saves ~$328/month for the duration. **Cost: AC-002A-01 says `infra/envs/{dev,staging,prod}` apply cleanly — deferring prod means that AC is partially unmet at gate time.** This is the one option that trades money against an acceptance criterion, so it is the Founder's call, not mine.
4. **Share one Cloud NAT across environments.** Rejected — it would put a shared network component in the middle of three isolated projects and undercut ADR-0007's environment separation for ~$66/month. I recommend against it.

**Identity Platform pricing is unresolved.** Identity Platform bills per monthly active user with a free tier, but multi-tenancy (the "one Identity Platform tenant per Sovereign tenant" model in S1-D07, `docs/STAGE1_FOUNDATION_SPEC.md:48`) is priced differently from the single-tenant free tier, and I could not confirm the current rate from the repository or from memory I trust. **I am not going to guess at a number that feeds a budget decision.** At two pilot tenants and ~20 users the cost is very likely negligible, but it should be confirmed on the pricing page before B-11. Flagged in §12 Q10.

Not modeled: GitHub Actions minutes (private repo, 2,000 free/month — the ring hold times are *sleep*, and sleeping burns paid minutes; at ≥15 min × 4 rings × several deploys/day this could become material and is worth watching), and the Better Stack free tier ($0).

---

## 12. Risks and open questions

**Findings — things already wrong in the repository, discovered during validation:**

- **F1 — `infra/policy/sovereign.rego` does not compile** (`:30`), so all seven rules are dead. §6.1.
- **F2 — the Conftest gate evaluates `.tf` source against plan-JSON rules and therefore always passes** (`.github/workflows/security-supply-chain.yml:87` vs `sovereign.rego:7`). §6.2. *This is the most serious finding: the repository currently has an IaC policy gate that structurally cannot fail.*
- **F3 — the DAST job always exits 0 when `PREVIEW_URL` is unset** (`.github/workflows/security-supply-chain.yml:136`). A second gate that cannot fail.
- **F4 — the Trivy action pin does not resolve** (`:62`), so the SCA gate never runs.
- **F5 — `lint` and `typecheck` both fail on `1b93aae`** and neither runs in CI, contradicting `work-orders/gate-records/WO-002-gate-record.md:62-63`, which records both as PASS at the accepted WO-002 commit. §2.2–2.3.
- **F6 — the PHI scanner will false-fail as soon as a build step precedes it** (`scripts/verify-synthetic-data.ts:29`). §2.1.
- **F7 — CODEOWNERS references GitHub teams that appear not to exist** (`CODEOWNERS:3-20`), so `require_code_owner_reviews` would enforce nothing. B-12.
- **F8 — 18 blocking Semgrep findings** on PR #4, untriaged. Not analyzed here; triage is part of S1-20.

Per `docs/GAP_REGISTER.md:41` ("New gaps discovered during any work order are appended here with a WO mapping before the work order can reach GO"), F1–F8 must be appended to the gap register. That edit is part of PR-A.

**Open questions — I have not guessed at any of these.**

**Q1 — `lint` and `typecheck` are required by the spec but fail today. Which sequencing?** `docs/STAGE1_FOUNDATION_SPEC.md:453` requires both in CI; S1-01's exit criterion is green verification. Options: (a) fix the 30 findings inside S1-01, widening its scope beyond WO-002A; (b) add the checks as non-required (reporting only) in S1-01 and promote them to required in S1-20 after a separate fix PR; (c) open a distinct remediation WO. I recommend **(b)** — it makes the regression visible immediately without either widening WO-002A or shipping a check nobody can pass. **Founder decision.**

**Q2 — Org policies at folder or project scope? REQUIRES SECURITY DECISION.** §3.1. Folder scope is strictly stronger and matches the spec's "one folder with org policies" (`docs/STAGE1_FOUNDATION_SPEC.md:42`), but requires org-level IAM at bootstrap and means Terraform no longer owns the constraint. Project scope is Terraform-managed but removable by a project owner. Michael should decide.

**Q3 — Who creates the `sovereign_admin` / `sovereign_app` Postgres roles?** §3.4. The spec puts them in the `cloudsql` module (`docs/STAGE1_FOUNDATION_SPEC.md:136`); I propose the migration job, to keep role credentials out of Terraform state. This is a deviation from the spec's module boundary. If the Founder prefers the spec as written, it needs an ADR for the state-contents implication.

**Q4 — Does the hello service persist?** §1.2. It proves AC-002A-03/04 and hosts the AC-002A-08 fault injection. Keeping it gives a permanent synthetic canary; removing it reduces attack surface. Recommend keeping it in dev only and destroying it in staging/prod after the ACs are evidenced.

**Q5 — Cloud Build or GitHub-hosted runners for image builds?** Affects the API list in §3.1 and cost. Recommend GitHub-hosted with WIF — one fewer GCP surface, and the provenance story is simpler.

**Q6 — Are the `tfstate` buckets Terraform-managed after bootstrap?** §3.5. Importing them makes drift visible; leaving them unmanaged avoids a root that can destroy its own backend. Recommend leaving unmanaged with a documented bootstrap script.

**Q7 — Is the constructed "two reviewers, one security CODEOWNER" acceptable? REQUIRES SECURITY DECISION.** §5.5. GitHub environments cannot express the requirement natively; setting the reviewer list to exactly {Andre, Michael} makes two approvals necessarily include Michael, but it is a construction that silently weakens if a third reviewer is ever added. Michael should confirm, and the constraint needs a comment in the workflow and a line in the gate record.

**Q8 — Is the assumed pilot load in §8.1 right?** Nothing in the repository states one. Every k6 threshold derives from it. A wrong assumption makes AC-002A-11's evidence meaningless.

**Q9 — Cosign keyless publishes to the public Rekor transparency log. Accepted? REQUIRES SECURITY DECISION.** §9. No PHI, but repository identity and commit SHAs become permanently public. The alternative is cosign with a KMS key (private, but reintroduces key management). Michael should decide before S1-20.

**Q10 — Identity Platform multi-tenancy pricing.** §11. Unconfirmed; feeds the budget. Needs a look at the current pricing page before B-11.

**Q11 — Do the WO-002B/C dependencies block AC sign-off?** Four monitoring alerts (§3.9), most threat-model boundaries (§7.1), most k6 scenarios (§8.2), and the adversarial-suite hook (§10) cannot be fully exercised until WO-002B/C land. I will mark each as `PROVISIONAL` in the gate record rather than claim coverage. The Founder should decide whether WO-002A can reach GO with provisional items or must wait — **this is the single biggest threat to a clean gate**, and it is a scoping decision, not an engineering one.

**Q12 — PR #4 has four failing checks including two of this WO's own gates.** Merging it makes `main` a baseline on which `sovereign.rego` does not compile. `AGENTS.md:85` requires "protected PRs and required checks only". I have not merged it and will not without an explicit instruction. Recommendation: fix F1 and F4 on the branch first (both are small), then merge.

**No clinical ambiguity was found in this work order.** WO-002A is infrastructure; `work-orders/WO-002A-cloud-foundation-iac-cicd.md:7` records that a clinical reviewer is not required, with Mark informed. Nothing here touches clinical semantics, so there is no `REQUIRES CLINICAL DECISION` item.

---

## 13. Evidence plan

All evidence lands in `work-orders/gate-records/WO-002A-gate-record.md`, which does not yet exist (`work-orders/gate-records/` currently holds WO-000, WO-001, WO-002). Every row cites a durable artifact — a CI run URL, a committed report, or an API transcript. Per `AGENTS.md:89`, *"Code generation or agent self-report alone is not evidence."*

| AC | Evidence artifact | Location | Signs |
|---|---|---|---|
| 01 | `terraform apply` CI run per env; `gcloud iam service-accounts keys list` across all SAs | run URLs + transcript in gate record | Andre (Owner), Michael (Security) |
| 02 | `tests/infra/org-policy.test.ts` output per project | CI run URL | Michael |
| 03 | Hello-service log: private-IP `SELECT 1` + KMS decrypt; `gcloud sql instances describe` showing no public IP | gate record | Roger (Architecture), Michael |
| 04 | Allowed vs blocked egress transcript + firing alert incident JSON | gate record | Michael |
| 05 | 72 rego unit tests green; 13 negative fixtures each failing as required | CI run URL | Michael |
| 06 | Release run for `v0.2.0-foundation-rc1`; `cosign verify` + `gh attestation verify` transcripts; four SBOMs attached | release page + gate record | Michael |
| 07 | ZAP baseline report (PR preview) + authenticated nightly report (staging); blocked-PR screenshot | `docs/reports/` + gate record | Michael |
| 08 | `deploy-dev.yml` run showing injection → rollback ≤2 min → auto-opened incident | run URL + incident link | Andre, Roger |
| 09 | `gh api .../branches/main/protection` JSON; resolved CODEOWNERS; blocked-merge and refused-admin-merge screenshots | gate record | Andre, Michael |
| 10 | `docs/threat-model/` (9 files) + `docs/DATA_RESIDENCY_MATRIX.md` with sign-off blocks | committed | Michael (security), Roger (architecture) |
| 11 | `docs/reports/load-2x-5x.md`, `docs/reports/dr-drill-01.md` with measured RTO/RPO vs NFR-002, status-page URL, `docs/runbooks/on-call.md`, `docs/runbooks/pir-template.md` | committed | Andre, Roger |
| 12 | Diff to `docs/SERVICE_ELIGIBILITY_MATRIX.md` (11 rows updated, 8 added) | committed | Andre, Michael |

**Signing authorities** (`work-orders/WO-002A-cloud-foundation-iac-cicd.md:6-9`): Owner **Andre Byrd** (Founder); Security reviewer **Michael**; Architecture reviewer **Roger**. Clinical review not required; **Mark** informed.

**NO-GO conditions**, restated verbatim in the gate record (`work-orders/WO-002A-cloud-foundation-iac-cicd.md:71`): any org-policy assertion fails, any SA key exists, or any required check can be bypassed.

The gate record will additionally carry a **Provisional items** section listing every control created but not yet exercisable pending WO-002B/C (§12 Q11), so that a reader cannot mistake an untested alert policy for a proven one.

---

## Request for Founder GO

This plan proposes no infrastructure and no code in this turn. I have created nothing, modified no workflow, and merged nothing.

Before S1-01 can begin I need:

1. **GO for S1-01 only** — package scaffolds, `--frozen-lockfile`, the PHI-scanner fix, and the gap-register append for F1–F8. One PR (PR-A).
2. **An answer to Q1** (lint/typecheck sequencing), which determines PR-A's contents.
3. **Acknowledgement of Q12** — PR #4's state, and whether F1/F4 are fixed before it merges.

Q2, Q7 and Q9 are security decisions for Michael and are not needed until S1-02 and S1-20 respectively. Q3–Q6, Q8, Q10 and Q11 can be resolved during S1-02 but Q11 should be settled before the gate record is drafted.

I am not authorized to approve any of this, and this plan is not evidence of anything beyond its own reasoning.
