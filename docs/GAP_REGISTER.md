# Gap Register — Repository vs. Enterprise SaaS Master Build Plan

Audit of the repository at the WO-002 GO commit against the immutable master plan (Phases 0–7) and the Stage 1 Foundation Specification. Status values: `PRESENT` (implemented with evidence), `PARTIAL` (documented or stubbed, not implemented/tested), `ABSENT`. Every non-PRESENT item maps to a closing work order and acceptance criterion.

| # | Plan item | Phase | Status | Evidence today | Closes in |
| --- | --- | --- | --- | --- | --- |
| G-01 | Tenant boundary model, RLS, dual DB roles | 0/2 | PRESENT | ADR-0009, migration 002, `architecture-rls-linter.test.ts` | — |
| G-02 | Provider-independent identity, authority grants, deny-by-default evaluator | 1 | PRESENT | ADR-0010, `packages/domain/src/authority/*`, 41 tests | — |
| G-03 | Synthetic-only PHI doctrine and scanner | 0 | PRESENT | ADR-0007, `scripts/verify-synthetic-data.ts` | — |
| G-04 | Architecture boundary enforcement | 4 | PRESENT | `scripts/verify-architecture.ts`, `tests/architecture.test.ts` | — |
| G-05 | Infrastructure as code (Terraform), one project per environment, org policies, private networking, deny-all egress | 1 | ABSENT | none (`infra/` did not exist) | WO-002A AC-01..04 |
| G-06 | Cloud environments dev/staging/prod with CMEK Cloud SQL, GCS, Pub/Sub, KMS, Secret Manager | 1/2 | ABSENT | Eligibility matrix lists targets only | WO-002A AC-02..04 |
| G-07 | CI security gates: SAST, SCA, secrets, container/IaC scan, DAST, SBOM, signed provenance | 5 | PARTIAL | gitleaks only; `--frozen-lockfile=false` | WO-002A AC-05..07 |
| G-08 | Promotion pipeline dev → staging → rings → prod with automatic rollback | 1/7 | ABSENT | single CI job, no deploy | WO-002A AC-08 |
| G-09 | Policy-as-code at PR (Conftest/OPA on IaC) | 1 | ABSENT | — | WO-002A AC-05 |
| G-10 | Branch protection, signed commits, real CODEOWNERS identities | 5 | PARTIAL | CODEOWNERS has placeholder team slugs | WO-002A AC-09 |
| G-11 | External IdP OIDC/SAML adapter, MFA policy, session lifetime/revocation | 1 | ABSENT | domain identity ports only | WO-002B AC-01..03 |
| G-12 | SCIM 2.0 provisioning/deprovisioning | 1 | ABSENT | — | WO-002B AC-04 |
| G-13 | Service-to-service auth (bound tokens + mTLS) and signed request context | 1 | ABSENT | — | WO-002B AC-05 |
| G-14 | API edge (Fastify gateway/BFF): JWT verify, trusted tenant resolution, rate limits, schema validation, idempotency keys, security headers | 4 | ABSENT | `services/*` are README-only | WO-002B AC-06..08 |
| G-15 | Dual control and break-glass workflows | 1 | PARTIAL | domain supports emergency-access state; no workflow | WO-002B AC-09 |
| G-16 | Per-tenant envelope encryption (DEK/KEK), BYOK/EKM option, crypto-shred | 2 | PARTIAL | ADR-0007 states requirement; no `packages/crypto` | WO-002C AC-01..02 |
| G-17 | Hash-chained, append-only clinical audit with seq/prev_hash, daily anchors, verification, authorized export | 5 | PARTIAL | `packages/audit` hash helpers; `authorization_audit_log` append-only; no chain/anchor/export | WO-002C AC-03..05 |
| G-18 | PHI-safe telemetry (OTel, allowlisted structured logging, redaction test) | 5/7 | ABSENT | policy text only | WO-002C AC-06 |
| G-19 | Kill-switch registry and integration-health endpoint | 4/7 | ABSENT | — | WO-002C AC-07 |
| G-20 | Retention classes, legal hold, erasure/tombstone jobs | 2 | PARTIAL | schedule documented; no schema/jobs | WO-002C AC-08 |
| G-21 | SIEM export sink (HEC/Sentinel/Chronicle) | 4 | ABSENT | — | WO-002C AC-09 |
| G-22 | Metering `billable_unit` projection on canonical events | 3 | ABSENT | — | WO-002C AC-10 |
| G-23 | STRIDE/DREAD threat model per trust boundary, Data Residency & Sovereignty Matrix | 0 | PARTIAL | one-page threat model; residency implied in eligibility matrix | WO-002A AC-10 |
| G-24 | Load model, chaos/DR drills, measured RTO/RPO, status page, on-call tiers, PIR template | 6/7 | ABSENT | — | WO-002A AC-11; WO-015 |
| G-25 | Third-party penetration test engagement | 5 | ABSENT | — | WO-015 / pre-G6 |
| G-26 | Outbound webhook engine (HMAC, backoff, DLQ) | 4 | ABSENT | outbox exists | WO-014 |
| G-27 | Service Eligibility Matrix entries for IdP vendor, Sentry, Terraform state backend | 0 | CLOSED | entries added; IdP selected by ADR-0012 | WO-002A AC-12 (promotion review) |
| G-28 | RLS session variable naming consistency | 2 | CLOSED | gate record corrected to `app.current_tenant` | ADR-0011 erratum |
| G-29 | Build outputs (`.next/`, `*.tsbuildinfo`) not ignored — untracked build artifacts on the marketing branch | 5 | CLOSED | `.gitignore` updated in the ADR-0011 commit | — |

## Rules for this register

1. A gap is closed only when its acceptance criterion has committed evidence in the corresponding gate record.
2. New gaps discovered during any work order are appended here with a WO mapping before the work order can reach GO.
3. This register is reviewed at every gate.
| G-30 | GitHub Actions referenced by mutable tags (18 Semgrep findings on first run) | 5 | CLOSED | all `uses:` pinned to commit SHAs in both workflows; Semgrep container pinned | — |
| G-31 | Conftest policies used pre-OPA-1.0 syntax and did not compile; no negative tests | 1 | CLOSED | `infra/policy/sovereign.rego` rewritten with `import rego.v1`; `infra/policy/tests/` (5 tests) run by `conftest verify` in CI | WO-002A AC-05 |
