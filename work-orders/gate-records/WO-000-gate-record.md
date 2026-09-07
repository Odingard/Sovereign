# Gate Record — WO-000 (Gate G0: Cloud, Security & PHI Architecture)

## Gate Status: G0-A GO (Synthetic/Local Dev) | G0-B HOLD (Real PHI / PHI-Capable Environment)

- **Work Order:** WO-000: Cloud, Security & PHI Architecture Gate
- **Date:** 2026-09-07
- **Authority Rule:** Under Sovereign Repository Constitution and Founder Instructions, only the Founder may approve a `GO` decision for production or PHI capability. Implementing AI agents cannot self-authorize PHI use.
- **Permitted Scope:** Local synthetic reference architecture, synthetic test harness, and downstream canonical domain planning/implementation using synthetic data only.

---

## Founder Gate Determination

1. **G0-A — Synthetic/Local Development: GO**
   - Sovereign may proceed to WO-001 (Canonical Domain Model) and downstream development using synthetic data only.
   - The approved local reference architecture (TypeScript, Node.js LTS, pnpm workspaces, PostgreSQL, Kysely, Temporal behind WorkflowRuntime port, Vitest, Biome, Docker Compose, Fake AI) is authorized.

2. **G0-B — Real PHI / PHI-Capable Environment: HOLD**
   - No real PHI may be ingested, stored, logged, transmitted, displayed, committed to Git, used in prompts, used in evaluations, or sent to any model, vendor, Google service, or external system until a separate PHI gate receives explicit Founder approval.
   - The existing `HOLD — NO REAL PHI` doctrine remains fully in force.
   - G0-A must never be reinterpreted as PHI authorization.

---

## Acceptance Criteria Verification Summary

| Acceptance Criterion | Status | Evidence Artifact |
| :--- | :--- | :--- |
| **AC-000-01**<br>Environments, trust boundaries, data flows, services, subprocessors, regions, keys, secrets, logs, backups, access, and incidents documented | **SATISFIED** | `docs/adr/ADR-0007-environment-trust-boundaries-and-phi-isolation.md`<br>`docs/DATA_CLASSIFICATION_SCHEDULE.md`<br>`docs/INCIDENT_RESPONSE_PLAN.md`<br>`docs/CODEOWNERS_MAPPING.md` |
| **AC-000-02**<br>Approved service eligibility, BAA, and configuration matrix exists | **SATISFIED** | `docs/SERVICE_ELIGIBILITY_MATRIX.md`<br>(Enforces all external services begin as `RESEARCH / NOT APPROVED FOR PHI`). |
| **AC-000-03**<br>Local synthetic bootstrap requires no production/cloud credentials | **SATISFIED** | `docs/adr/ADR-0006-local-stack-and-toolchain-selection.md`<br>`docker-compose.yml`<br>`packages/`<br>(Local synthetic execution verified with zero cloud credentials). |
| **AC-000-04**<br>Clinical, privacy, security, and founder reviewers sign residual risks | **SATISFIED** | `work-orders/risk-registers/WO-000-risk-register.md`<br>(Deferred clinical items recorded in `docs/DEFERRED_CLINICAL_DECISIONS.md`). |
| **AC-000-05**<br>Explicit PHI decision (`NO PHI`, bounded `GO`, or `HOLD`) | **SATISFIED** | Explicit dual determination: **`G0-A GO (Synthetic)`** and **`G0-B HOLD (Real PHI)`**.<br>No real PHI permitted in dev, prompts, tests, logs, or services. |
| **AC-000-06**<br>CI and repository scans prevent secrets and prohibited datasets | **SATISFIED** | `.gitleaks.toml`<br>`scripts/verify-synthetic-data.ts`<br>`scripts/verify-architecture.ts`<br>Automated architectural & synthetic data test suites. |

---

## Gate Approvals

- Platform / Security Lead: *Approved (Synthetic Only)*
- Clinical Safety Lead: *Approved (Synthetic Only)*
- Security / Privacy Lead: *Approved (Synthetic Only)*
- **Founder Gate Decision:** 
  - **G0-A (Synthetic/Local): `GO`**
  - **G0-B (Real PHI): `HOLD`**
