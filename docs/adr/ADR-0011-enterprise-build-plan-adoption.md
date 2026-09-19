# ADR-0011 — Adoption of the Enterprise SaaS Master Build Plan and Reconciliation of the Stage 1 Foundation Specification

Status: Proposed (Founder acceptance required)

## Context

Sovereign has completed WO-000 (G0-A GO), WO-001, and WO-002 (CLOSED — GO) on a local-first, provider-independent reference architecture (ADR-0006 through ADR-0010). Separately, the founder adopted an immutable Enterprise SaaS Master Build & Execution Plan (Phases 0–7, Gates 0–4) governing every SaaS product, and a Stage 1 Foundation Build Specification (v1.1) was authored before the repository state was inspected.

A gap audit (`docs/GAP_REGISTER.md`) shows the repository is strong on domain authority, tenancy, and PHI doctrine, and has no implementation of: infrastructure as code, cloud environments, external identity edge (OIDC/SAML, SCIM, MFA, sessions), API edge, supply-chain security gates (SAST/SCA/container/IaC/DAST/SBOM/provenance), per-tenant envelope encryption, hash-chained clinical audit with anchoring, PHI-safe telemetry, kill switches, integration health, retention/erasure/legal-hold execution, SIEM export, metering events, ring rollout, load/chaos/DR, or a STRIDE/DREAD threat model.

The Stage 1 specification also named tooling (NestJS, Drizzle, Node 22, OPA for application authorization) that conflicts with accepted ADRs.

## Decision

1. **The Enterprise SaaS Master Build Plan is adopted as the governing lifecycle for Sovereign.** `docs/ENTERPRISE_BUILD_PLAN.md` instantiates it. The existing G0–G6 release gates remain and are mapped onto the plan's Gates 0–4; neither gate set may be waived by the other.
2. **Accepted ADRs win on tooling.** The Stage 1 specification is reconciled as follows and re-issued as `docs/STAGE1_FOUNDATION_SPEC.md`:
   - HTTP framework: **Fastify** (ADR-0006), not NestJS.
   - Query/migrations: **Kysely** (ADR-0006), not Drizzle.
   - Runtime: **Node.js 20 LTS** (`.nvmrc`), upgrade to 22 by separate ADR.
   - Application/clinical authorization: the **Sovereign domain `AuthorizationEvaluator`** (ADR-0010) is the sole application policy engine. OPA is used only as **policy-as-code for infrastructure and CI** (Conftest on Terraform/Kubernetes-style manifests), never for clinical or tenant authorization.
   - Workflow: **Temporal behind the `WorkflowRuntime` port** (ADR-0006); Temporal history is never authoritative.
   - Package layout: the ADR-0006 tiers (`domain → contracts → application → persistence/workflow-runtime/audit`, with `providers/` and `adapters/`) are retained. The Stage 1 `packages/kernel|telemetry|crypto` additions are created as new tier packages that depend only on `contracts`/`domain`.
3. **Identity edge is an adapter.** External IdP (OIDC/SAML), SCIM 2.0, MFA policy, and session/revocation are implemented in `adapters/identity-*` behind the ADR-0010 identity ports. The IdP vendor is selected through the Service Eligibility Matrix (BAA required); Auth0 is the leading candidate and remains `RESEARCH / NOT APPROVED FOR PHI` until promoted.
4. **RLS session variable is standardized as `app.current_tenant`** (matches migration 002 and `client.ts`); the WO-002 gate record's `sovereign.current_tenant` wording is corrected as a documentation erratum.
5. **New work orders WO-002A, WO-002B, WO-002C** close the Phase 1/2/5 foundation gaps before WO-003 implementation begins. They are inserted into the build sequence and are P0/CRITICAL. WO-003 planning may continue in parallel; WO-003 implementation is HOLD until WO-002A–C reach GO.
6. **Metering events are a Phase 3 obligation, not a pricing decision.** Every canonical domain event published through the outbox carries a `billable_unit` projection; pricing remains outside the build baseline (PRD O-009).
7. **Sentry** (present via the marketing site dependency tree) is added to the Service Eligibility Matrix as `PROHIBITED` for any PHI-capable app until a BAA and PHI-safe configuration are verified; marketing-site use with no PHI is permitted.

## Consequences

- Positive: one governing lifecycle, no duplicate authority between plan gates and repo gates, tooling conflicts eliminated.
- Positive: foundation gaps are closed before clinical-state work builds on them.
- Negative: WO-003 implementation start moves behind WO-002A–C.
- Negative: Terraform, GCP project structure, and an IdP vendor must be selected and reviewed under the eligibility process before staging exists.

## Rejected alternatives

- Re-platforming to the Stage 1 tooling as written: rejected; would discard accepted ADRs and passing WO-001/002 evidence for no safety gain.
- Deferring foundation gaps to WO-015: rejected; audit chain, telemetry redaction, and encryption are prerequisites for every WO that persists clinical data.

## Verification

- `docs/GAP_REGISTER.md` items each map to a WO acceptance criterion.
- `docs/STAGE1_FOUNDATION_SPEC.md` contains no reference to NestJS, Drizzle, or OPA-for-application-authorization (checked by `rg`).
- Gate records for WO-002A–C exist with named human approvers before WO-003 implementation begins.
