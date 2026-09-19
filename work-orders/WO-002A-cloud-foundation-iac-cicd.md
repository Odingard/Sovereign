# WO-002A — Cloud Foundation, Infrastructure as Code & Delivery Pipeline

Status: READY (blocks WO-003 implementation)  
Priority: P0  
Risk: CRITICAL  
Owner: Andre Byrd (Founder)
Clinical reviewer: Not required — Mark (Clinical reviewer) informed
Security reviewer: Michael
Architecture reviewer: Roger

## Objective and rationale

Create the cloud fabric, environments, policy-as-code, supply-chain gates, and promotion pipeline the master plan requires (Phases 1.2, 5.1, 7.1) so that every later work order deploys through a governed path. Today the repository has no infrastructure, no deploy path, and a CI job that scans secrets only. Building clinical services before this exists would force retrofits into the security boundary.

## Dependencies/inputs

WO-000 (G0-A GO), WO-002 (GO), ADR-0006/0007/0011, `docs/SERVICE_ELIGIBILITY_MATRIX.md`, `docs/ENTERPRISE_BUILD_PLAN.md`, `docs/STAGE1_FOUNDATION_SPEC.md` §3 and §9.

## Scope

- Terraform modules and per-environment roots for `sovereign-dev`, `sovereign-staging`, `sovereign-prod` (GCP, `us-central1`): project + APIs + org policies, VPC/private subnet/PSC/serverless connector/Cloud NAT with deny-all egress allowlist, Cloud KMS keyrings and KEKs (`db-kek`, `gcs-kek`, `tenant-kek`, HSM in prod), Cloud SQL Postgres 16 (private IP, CMEK, pgaudit, IAM auth), GCS buckets (`artifacts`, `audit-anchors` with locked retention, `exports`), Pub/Sub topics + DLQs, Secret Manager placeholders, per-service service accounts, Workload Identity Federation for GitHub, Cloud Run service module, monitoring/alerting/SLO module.
- Remote Terraform state (GCS, versioned, CMEK), `plan` on PR, `apply` on merge (dev), manual approval (staging/prod).
- Policy-as-code: Conftest/OPA policies over Terraform plans (no public IPs, CMEK required, region lock, no SA keys, uniform bucket access) and Checkov.
- CI hardening: `--frozen-lockfile` (true), Semgrep (OWASP + custom rule: tenant id read from request outside gateway), `pnpm audit --audit-level=high`, Trivy (fs + image), Checkov, CycloneDX + SPDX SBOM, cosign keyless signing, SLSA provenance, ZAP baseline DAST against ephemeral preview, nightly authenticated ZAP on staging.
- Deploy workflow: build → Artifact Registry → migration job (`sovereign_admin` role via Secret Manager) → Cloud Run rings (internal canary → 1% → 10% → 50% → 100%, ≥15 min per ring, auto-rollback on SLO burn or P99 breach) → adversarial suite → staging → prod approval (two reviewers, one security CODEOWNER).
- Branch protection on `main`: PR required, signed commits, linear history, required checks, two reviews for `infra/`, `packages/crypto`, `packages/kernel`, `.github/`.
- CODEOWNERS: replace placeholder team slugs with real GitHub identities via governance PR.
- STRIDE threat model per trust boundary with DREAD scoring; Data Residency & Sovereignty Matrix.
- Load model (k6, 2× and 5× projected pilot load, two synthetic tenants); first chaos/DR drill (Cloud SQL failover, KMS unavailable → fail closed, Pub/Sub backlog, IdP outage) with measured RTO/RPO vs NFR-002; private status page; on-call tiers; PIR template.
- Service Eligibility Matrix updates: Terraform state backend, GitHub Actions, IdP candidate, Sentry (`PROHIBITED` for PHI apps).

## Out of scope

Application code for identity edge (WO-002B), audit/crypto/telemetry packages (WO-002C), any PHI in any environment (G0-B HOLD remains), pen test execution (pre-G6), cost/pricing.

## Requirements and rules

- No resource is created outside Terraform; console changes are defects.
- Zero public IPs on backend compute; Cloud SQL private IP only; uniform bucket access; CMEK everywhere PHI could land.
- Service-account key creation disabled at org policy; GitHub authenticates via WIF only.
- Egress allowlist is data in the network module; adding a destination requires security review.
- Every CI security gate is required on `main`; a failing gate cannot be bypassed by label or admin merge.
- Migrations are expand/contract; destructive migrations require a `## Rollback` section and a separate PR.
- Staging and prod use synthetic data only until G0-B GO.

## Safety/security/audit/ports

Org policies as listed; KMS IAM separation (services get encrypter/decrypter on `tenant-kek` only); JIT prod access via PAM with ticket ID and 4 h maximum; all admin actions logged to Cloud Audit Logs with export to the SIEM sink (WO-002C). Ports: none new (infrastructure only).

## Failure/tests

Terraform plan drift detection nightly; policy-as-code negative tests (a plan with a public IP must fail); pipeline negative tests (unsigned image cannot deploy, failing SAST blocks merge); rollback injection (5% synthetic errors in Ring 0 → automatic rollback ≤2 min, incident auto-opened); DR drill restores to a scratch instance and validates checksums.

## Acceptance criteria

- AC-002A-01: `infra/envs/{dev,staging,prod}` apply cleanly from CI with WIF; no SA keys exist in any project.
- AC-002A-02: Org-policy assertions pass (no external IPs, no SA keys, region lock, uniform bucket access) — automated test.
- AC-002A-03: Cloud SQL, GCS, Pub/Sub, KMS, Secret Manager provisioned with CMEK; private connectivity proven from a Cloud Run hello service.
- AC-002A-04: Deny-all egress proven; allowlisted destination reachable, non-allowlisted blocked and alerted.
- AC-002A-05: Conftest/Checkov gates fail a deliberately non-compliant plan.
- AC-002A-06: SAST, SCA, secrets, container scan, SBOM (CycloneDX + SPDX), cosign signature, SLSA provenance present on a tagged build.
- AC-002A-07: ZAP baseline runs on PR preview; authenticated ZAP nightly on staging; high findings block.
- AC-002A-08: Ring deploy + automatic rollback proven by injection test on dev.
- AC-002A-09: Branch protection and real CODEOWNERS enforced (screenshot + API evidence).
- AC-002A-10: STRIDE/DREAD threat model and Data Residency & Sovereignty Matrix reviewed and signed.
- AC-002A-11: k6 load report (2×/5×), first chaos/DR drill report with measured RTO/RPO, status page live, on-call and PIR template approved.
- AC-002A-12: Service Eligibility Matrix updated for every new service touched by this WO.

## Documentation/evidence/decision

`infra/README.md`, ADR for any deviation, threat model, residency matrix, pipeline run links, drill reports, gate record. **NO-GO** if any org-policy assertion fails, any SA key exists, or any required check can be bypassed.

## Mandatory work-order field index

| Required field | Binding location/content |
| --- | --- |
| Status | Header metadata; must be updated only from acceptance evidence. |
| Priority | Header metadata. |
| Risk | Header metadata and residual-risk gate review. |
| Owner | Header role; assign a named human before execution. |
| Clinical reviewer | Header role; independent named human approval required where applicable. |
| Security reviewer | Header role; independent named human approval required where applicable. |
| Objective | Objective section above. |
| Product rationale | Objective/rationale section above; explains why the control matters to Sovereign. |
| Dependencies | Dependencies/inputs section above; unresolved dependency blocks start. |
| Inputs | Dependencies/inputs section above; inputs must be versioned and attributable. |
| Scope | Scope section above; no silent expansion. |
| Explicitly out of scope | Out-of-scope section above; prohibited work remains prohibited. |
| Functional requirements | Requirements section above and acceptance criteria below it. |
| Domain rules | Domain rules in the requirements section; repository constitution also applies. |
| Safety requirements | Safety controls above plus independent clinical-safety review. |
| Security/privacy requirements | Security/privacy controls above plus WO-000 restrictions. |
| Audit requirements | Audit controls above; consequential work requires durable audit. |
| Adapter/port requirements | Ports/adapters section above; core remains provider independent. |
| Failure behavior | Failure section above; identity/evidence/authority ambiguity fails closed. |
| Test requirements | Test section above; synthetic positive, negative, replay and failure tests required. |
| Acceptance criteria | Numbered AC list above; every item requires objective evidence. |
| Required documentation | Documentation/evidence section above. |
| Completion evidence | Documentation/evidence section; self-report is insufficient. |
| Go / Hold / No-Go decision | Final decision statement above; only designated humans approve GO. |
