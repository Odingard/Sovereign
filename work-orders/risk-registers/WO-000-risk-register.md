# Risk Register — WO-000 (Gate G0)

## Overview & Governance

This risk register documents known architectural, clinical safety, security, privacy, and operational hazards evaluated during WO-000 (Cloud, Security & PHI Architecture Gate). In accordance with Sovereign Doctrine, missing named human authorities or unmapped external teams keep the gate status on **HOLD**, while permitting local synthetic reference implementation to proceed.

---

## Hazard & Risk Ledger

| Risk ID | Category | Hazard Description | Initial Severity | Mitigation & Controls | Residual Risk | Reviewer Role & Authority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-000-01** | Privacy / PHI | Accidental introduction of real patient data into local development or Git history. | CRITICAL | Default gate posture `HOLD — NO REAL PHI`. Gitleaks scanning (`.gitleaks.toml`) + dedicated synthetic data verification scanner (`scripts/verify-synthetic-data.ts`). Pre-commit & CI failure on non-synthetic patterns. | LOW | Security / Privacy Reviewer |
| **RSK-000-02** | Clinical Safety | AI model output directly mutating clinical state or executing external orders. | CRITICAL | ADR-0001, ADR-0005, and ADR-0006 enforce mandatory mutation path. Automated architectural tests verify AI provider code cannot import mutation repositories. | LOW | Clinical Safety Reviewer |
| **RSK-000-03** | Architecture | Vendor cloud SDKs (GCP, Temporal, EHR) leaking into canonical domain logic. | HIGH | ADR-0002, ADR-0004, and ADR-0006 mandate strict one-way dependency rule (`adapters/providers → application → domain`). Enforced via automated architecture test suite. | LOW | Sovereign Architect |
| **RSK-000-04** | Security | Unmapped GitHub team slugs in `CODEOWNERS` leading to unreviewed branch merges. | HIGH | `docs/CODEOWNERS_MAPPING.md` established. Remote GitHub branch protection and external contributor access strictly blocked until slugs are bound to verified human teams. | ACCEPTABLE FOR LOCAL DEV | Security / Privacy Reviewer |
| **RSK-000-05** | Governance | Missing named human individuals for required gate sign-off roles. | MEDIUM | Human role requirements maintained (Founder, Platform/Security Owner, Clinical Safety Reviewer, Security/Privacy Reviewer). Pre-production and PHI gate remains HOLD until humans are named. Local synthetic development permitted. | ACCEPTABLE FOR SYNTHETIC DEV | Founder Gate Authority |
| **RSK-000-06** | Workflow | Workflow engine (Temporal) treated as the authoritative state store rather than an orchestrator. | HIGH | ADR-0003 and ADR-0006 explicitly state Sovereign PostgreSQL database owns the Execution Graph. Temporal operates strictly behind `WorkflowRuntime` port. | LOW | Workflow Reviewer |
| **RSK-000-07** | Privacy | Third-party AI vendors retaining prompts or training foundation models on healthcare data. | HIGH | Service Eligibility Matrix marks all external AI as `RESEARCH / NOT APPROVED FOR PHI`. Zero-data-retention (ZDR) and customer BAA required before any non-mock AI promotion. | LOW (MOCK AI ONLY) | Security / Privacy Reviewer |

---

## Reviewer Sign-Off Status

| Role | Required Sign-Off Authority | Current Review Status | Decision |
| :--- | :--- | :--- | :--- |
| **Platform / Security Owner** | Platform Engineering Lead | Synthetic architecture verified | **CONDITIONAL PASS** (Synthetic Only) |
| **Sovereign Architect** | Lead System Architect | One-way package boundaries & ADRs verified | **PASS** |
| **Clinical Safety Reviewer** | Rheumatology Safety Lead | Deferred clinical items registered; AI mutation prevented | **CONDITIONAL PASS** (Synthetic Only) |
| **Security / Privacy Reviewer** | Security & Privacy Officer | PHI scanning & Service Eligibility verified | **CONDITIONAL PASS** (Synthetic Only) |
| **Founder Gate Authority** | Sovereign Health AI Executive | Final gate sign-off | **HOLD — NO REAL PHI** |
