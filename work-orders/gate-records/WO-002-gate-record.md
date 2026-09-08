# Gate Record — WO-002 (Tenancy, Identity, and Authority Model)

## Gate Status: CLOSED — GO (Synthetic/Local Development) | HOLD (Real PHI)
### G0-A: GO (Synthetic/Local Development Only) | G0-B: HOLD (Real PHI / PHI-Capable Environment)

- **Work Order:** WO-002 — Tenancy, Identity, and Authority Model
- **Branch:** `wo/002-tenancy-identity-authority`
- **Accepted Implementation Commit:** `9db46d1`
- **Constitution Commit:** `fac7404` (Tenets 17–19 added)
- **Pull Request:** PR #2 (`wo/002-tenancy-identity-authority` → `main`) — MERGED
- **Permanent Security Doctrine:**
  > **Identity is not authority.**  
  > **A role is not an authority grant.**  
  > **Tenant membership is not patient authorization.**  
  > **Authentication success is not permission to act.**  
  > **The requester does not define the security requirements for its own request.**  
  > **Intent is not authority. Authority is not evidence. Evidence is not execution. Execution is not completion.**  
  > **AI may possess an authenticated technical identity for auditing and tool invocation but may never become a source of clinical authority.**

---

## 1. Criterion-by-Criterion Evidence

| Acceptance Criterion | Status | Evidence & Verification Details |
| :--- | :--- | :--- |
| **AC-002-01**<br>Provider-Independent Actor & Identity Model | **SATISFIED** | Implemented in `packages/domain/src/identity/actor.ts` and `context.ts`. Actors have strongly typed `ActorKind` (`HUMAN_CLINICIAN`, `HUMAN_PATIENT`, `HUMAN_STAFF`, `AI_AGENT`, `EXTERNAL_SYSTEM`, `SYSTEM_SERVICE`), tenant-scoped `ActorId`, professional credentials, and relationships (`RelationshipTarget = ACTOR \| PATIENT`). External provider IDs map deterministically via `IdentityMappingRepository` without vendor leakage into domain contracts. |
| **AC-002-02**<br>Server-Resolved AuthoritativeSecurityContext | **SATISFIED** | Implemented in `packages/domain/src/identity/context.ts`. Resolves trusted actor identity, active tenant, authorized patient scope, authority grants, emergency access state, and provenance. Requesters cannot invent or assert their own context. |
| **AC-002-03**<br>Controlled Capability & ActionDefinition Registry | **SATISFIED** | Implemented in `packages/domain/src/authority/capabilities.ts` and `action-definition.ts`. Registry defines trusted capabilities across Authority Classes (A, B, C, D). Security requirements (required authority class, patient context necessity, evidence necessity, permitted actor kinds, emergency policy) are strictly server-resolved; requesters cannot specify security requirements. |
| **AC-002-04**<br>Scoped, Revocable, and Delegable AuthorityGrant | **SATISFIED** | Implemented in `packages/domain/src/authority/authority-grant.ts`. Supports exact tenant, actor, authority class, allowed capabilities, patient constraints, temporal validity (`validFrom` to `expiresAt`), delegation chains, and explicit revocation records (`revocation !== undefined` is the single source of truth). |
| **AC-002-05**<br>Server-Resolved AuthorizationBinding | **SATISFIED** | Implemented in `packages/domain/src/authority/authorization-binding.ts`. Binds actions strictly to exact server-resolved state (patient, intent, execution graph, node, content hash). Requesters identify target resources, but Sovereign server-derives the binding for policy evaluation. |
| **AC-002-06**<br>Typed AuthorizationDecision with Structured Facts | **SATISFIED** | Implemented in `packages/domain/src/authority/authorization-decision.ts`. Decisions (`PERMIT`, `DENY`, `REQUIRES_CLINICAL_AUTHORIZATION`) contain structured, strongly-typed `AuthorizationReasonFacts` keyed by `AuthorizationReasonCode` with zero untyped JSON escape hatches. |
| **AC-002-07**<br>Deterministic AuthorizationEvaluator | **SATISFIED** | Implemented in `packages/domain/src/authority/authorization-evaluator.ts`. Enforces deny-by-default, tenant isolation, patient binding checks, grant validity, revocation checks, expired grant rejection, Class D (clinical judgment) AI exclusion, and delegation constraints. |
| **AC-002-08**<br>Append-Only Authorization Audit Log | **SATISFIED** | Implemented in `packages/domain/src/authority/audit.ts` and `packages/persistence/src/repositories/authorization-audit-repository.ts`. Records all evaluated decisions with full context, evaluated grants, and structured reason facts. PostgreSQL table permissions restrict `sovereign_app` to `INSERT` and `SELECT` only; database-level rejection of `UPDATE` and `DELETE`. |
| **AC-002-09**<br>PostgreSQL Row-Level Security (RLS) & Dual-Role Architecture | **SATISFIED** | Implemented in migration `002_identity_and_authority_schema.ts` and `packages/persistence/src/client.ts`. Enforces `FORCE ROW LEVEL SECURITY` across all 13 tenant-scoped tables (including `domain_outbox_events`). Runtime queries execute as `sovereign_app` with `SET LOCAL sovereign.current_tenant = :tenantId`. Superuser/DDL migrations run as `sovereign_admin`. |
| **AC-002-10**<br>Automated RLS Schema Linter | **SATISFIED** | Implemented in `tests/architecture-rls-linter.test.ts`. Inspects PostgreSQL `pg_tables`, `pg_policy`, and `pg_class` to statically and dynamically prove every tenant table has RLS enabled, `relforcerowsecurity = true`, tenant isolation policy installed, and zero multi-tenant tables bypass RLS. |
| **AC-002-11**<br>Formal ADR Governance (ADR-0009 & ADR-0010) | **SATISFIED** | Documented in `docs/adr/ADR-0009-defense-in-depth-multi-tenancy-rls.md` (PostgreSQL RLS Defense-in-Depth) and `docs/adr/ADR-0010-provider-independent-identity-and-authority.md` (Provider-Independent Identity and Scoped Authority Grants). |
| **AC-002-12**<br>Negative & Isolation Test Coverage | **SATISFIED** | Verified in `tests/identity-and-authority-domain.test.ts` (30 tests) and `tests/persistence-identity-and-authority.test.ts` (11 tests). Covers cross-tenant access attempts, cross-patient access attempts, expired grants, revoked grants, AI attempting Class C/D operations, missing patient context, caller-forged security requirements, and database-level RLS isolation. |

---

## 2. Automated Test Suite Results

```text
 RUN  v2.1.9 /Users/dre/dev/Sovereign

 ✓ tests/identity-and-authority-domain.test.ts (30 tests) 7ms
 ✓ tests/persistence-postgres.test.ts (11 tests) 546ms
 ✓ tests/persistence-identity-and-authority.test.ts (11 tests) 325ms
 ✓ tests/domain-invariants.test.ts (10 tests) 6ms
 ✓ tests/intent-and-execution-authority.test.ts (5 tests) 3ms
 ✓ tests/domain-clarifications.test.ts (5 tests) 5ms
 ✓ tests/architecture.test.ts (7 tests) 7ms
 ✓ tests/architecture-rls-linter.test.ts (4 tests) 237ms

 Test Files  8 passed (8)
      Tests  83 passed (83)
```

- **Synthetic Data & PHI Scan (`pnpm run test:phi`):** **PASS** (Zero PHI patterns detected).
- **Architecture Boundary Scan (`pnpm run test:arch`):** **PASS** (Pure domain preserved; 0 external/cloud/vendor dependencies in `@sovereign/domain`).
- **PostgreSQL RLS Linter (`tests/architecture-rls-linter.test.ts`):** **PASS** (100% tenant tables enforce RLS).
- **TypeScript Typecheck (`pnpm run typecheck`):** **PASS** (0 errors).
- **Biome Lint & Format (`pnpm run lint`):** **PASS** (0 errors).
- **Remote CI:** Passed workflow runs `34192744069` and `34198210113`.

---

## 3. Implementation Decisions & ADR Governance

1. **ADR-0009 — Defense-in-Depth Multi-Tenancy via PostgreSQL Row-Level Security:**
   - Formalized requirement for database-level tenant isolation using session variable `sovereign.current_tenant` combined with application-level repository scoping.
   - Dual-role security model: `sovereign_admin` (DDL, migration runner) vs. `sovereign_app` (runtime query executor, bounded permissions, NOBYPASSRLS).
   - Append-only audit table prevents record mutation or erasure even by application runtime credentials.

2. **ADR-0010 — Provider-Independent Identity & Scoped Authority Grants:**
   - Separation of technical identity (`ActorId`), external provider identifiers (`IdentityMapping`), and clinical authority (`AuthorityGrant`).
   - Server-resolution of action security requirements (`ActionDefinitionRegistry`) and authorization targets (`AuthorizationBinding`).
   - Explicit prevention of AI agents exercising Class C (clinician-authorized transactions) or Class D (clinical judgment) authority.

---

## 4. Founder Gate Determination

- **Founder Decision:** **`CLOSED — GO`** (Approved and merged into `main`).
- **PHI Gate Posture:** **`HOLD — NO REAL PHI`** remains strictly in force across all environments. No PHI capability is authorized by closing WO-002.
- **Status of WO-003:** Planning authorized on branch `wo/003-ra-clinical-state-model`. Implementation remains on **`HOLD`** until Founder review and approval of the WO-003 implementation plan.
