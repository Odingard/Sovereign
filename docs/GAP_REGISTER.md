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
| G-30 | GitHub Actions referenced by mutable tags (18 Semgrep findings on first run) | 5 | CLOSED | all `uses:` pinned to commit SHAs in both workflows; Semgrep container pinned | — |
| G-31 | Conftest policies used pre-OPA-1.0 syntax and did not compile; no negative tests | 1 | CLOSED | `infra/policy/sovereign.rego` rewritten with `import rego.v1`; `infra/policy/tests/` (5 tests) run by `conftest verify` in CI | WO-002A AC-05 |
| G-32 | SCA gate found critical/high advisories on first run: vitest (<3.2.6), next (<15.5.24 RCE), kysely (<=0.28.13 SQLi), plus transitive tmp/vite/postcss | 5 | CLOSED | vitest ^3.2.6, next ^15.5.24 (early-access page migrated to async searchParams), kysely ^0.28.14; pnpm overrides for tmp/vite/postcss; extract-zip (no patch, Lighthouse dev-only) ignored with justification in package.json `pnpm.auditConfig` | WO-002A AC-06 (quarterly re-evaluation) |
| G-33 | `pnpm run lint` and `pnpm run typecheck` fail on `main` (pre-existing: TS2552 in authorization-audit-repository, TS5097 `.ts` import extensions in tests, TS2322 in domain-clarifications test, Biome formatting/non-null assertions) and neither is a blocking CI check | 5 | OPEN | ci.yml runs `verify` only | WO-002A S1-01 (make lint + typecheck required and green before any 002A infra PR) |
| G-34 | Conftest gate evaluates Terraform **source** (`conftest test infra/envs/$env`) while every rule reads `input.resource_changes`, which exists only in `terraform show -json` plan output — so no rule can ever match and the gate exits 0 | 1 | OPEN | plan §6.2 (F2); `security-supply-chain.yml:86-90` vs `infra/policy/sovereign.rego`; currently vacuous either way because the env roots declare zero resources | WO-002A AC-05 (S1-20) |
| G-35 | DAST job exits 0 when `PREVIEW_URL` is unset, so the gate cannot fail | 5 | OPEN | plan §5.2 (F3); `security-supply-chain.yml:135-137` | WO-002A AC-07 (S1-20) |
| G-36 | `sbom-provenance` uses `needs: [sast, sca, iac]`; GitHub counts a **skipped** required check as satisfied for branch protection, so a dependency failure silently satisfies the gate | 5 | OPEN | audit A-1; `security-supply-chain.yml:95`. Fix: `if: always()` plus an explicit failure when any dependency failed | WO-002A AC-06/AC-09 (S1-20) |
| G-37 | PR preview environment is undesigned; AC-002A-07 depends on it (no environment row, no teardown, no cost line) | 1/5 | OPEN | audit A-2; plan §5.2 names `deploy-preview.yml` but never specifies it. Recommended: tagged Cloud Run revisions in `sovereign-dev`, 24 h TTL, synthetic only | WO-002A AC-07 (S1-20/S1-21) |
| G-38 | `required_signatures` is a separate branch-protection endpoint, not a field of the protection PUT body | 5 | OPEN | audit A-3; plan §5.7 shows it inline. Evidence step must call `PUT .../protection/required_signatures` as well | WO-002A AC-09 (S1-20) |
| G-39 | Ring holds implemented as `sleep` in GitHub Actions burn paid runner minutes and are fragile across runner restarts | 7 | OPEN | audit A-4; plan §5.4. Evaluate Google Cloud Deploy native Cloud Run canary with automated rollback before committing to sleep-based rings — architecture decision (Roger) | WO-002A AC-08 (S1-21) |
| G-40 | `CODEOWNERS` references GitHub teams that do not appear to exist (`@sovereign-health-ai/*`); GitHub silently ignores unresolvable owners, so `require_code_owner_reviews` would enforce nothing | 5 | OPEN | plan §4 B-12 (F7); `CODEOWNERS:3-20` — only `@andrebyrd-odingard` resolves | WO-002A AC-09 (Founder bootstrap B-12) |
| G-41 | PHI scanner reported four `.next/` false positives — **withdrawn, not a defect** | 5 | CLOSED | plan §2.1 (F6) was produced against branch `wo/002a-...` at `1b93aae`, which was one commit behind `main`; `.next` was already added to `IGNORE_DIRS` in `817b992` (`scripts/verify-synthetic-data.ts:29`). `pnpm run verify` passes on `main`. Recorded so the frozen plan's §2.1 is not re-raised | — |

## Rules for this register

1. A gap is closed only when its acceptance criterion has committed evidence in the corresponding gate record.
2. New gaps discovered during any work order are appended here with a WO mapping before the work order can reach GO.
3. This register is reviewed at every gate.
