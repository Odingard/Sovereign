# Gate Record — WO-001 (Sovereign Canonical Domain Model)

## Gate Status: CLOSED — GO (Synthetic/Local Development) | HOLD (Real PHI)
### G0-A: GO (Synthetic/Local Development) | G0-B: HOLD (Real PHI / PHI-Capable Environment)

- **Work Order:** WO-001 — Sovereign Canonical Domain Model
- **Branch:** `wo/001-canonical-domain-model`
- **Permanent Doctrine:**
  > **Intent is not authority.**  
  > **Authority is not evidence.**  
  > **Evidence is not execution.**  
  > **Execution is not completion.**

---

## 1. Criterion-by-Criterion Evidence

| Acceptance Criterion | Status | Evidence & Verification Details |
| :--- | :--- | :--- |
| **AC-001-01**<br>Five independent aggregates exist in code and persistence; never collapsed into single JSON | **SATISFIED** | Implemented as distinct aggregates in `@sovereign/domain`: `ClinicalEvidenceAggregate`, `ClinicalStateAggregate`, `ClinicalIntentAggregate`, `ExecutionGraphAggregate`, `TherapyAccessStateAggregate`. Stored in dedicated relational tables (`clinical_evidence`, `clinical_states`, `clinical_intents`, `execution_graphs`, `therapy_access_cases`). Verified in `tests/persistence-postgres.test.ts`. |
| **AC-001-02**<br>Epistemic truth model supports UNKNOWN (not negative), CONFLICTED, and REQUIRES_CLINICAL_DECISION | **SATISFIED** | Defined in `packages/domain/src/common/epistemic-status.ts`. Verified in `tests/domain-invariants.test.ts` (Invariant 1, 2, 3). Invariant violation thrown if UNKNOWN is asserted as negative. |
| **AC-001-03**<br>Complete 12-state Clinical Intent lifecycle & execution planning boundary | **SATISFIED** | Defined in `packages/domain/src/intent/intent-lifecycle.ts` (`DISCUSSED`, `CONSIDERED`, `CONDITIONAL`, `RECOMMENDED`, `PLANNED`, `DECIDED`, `ORDERED`, `AUTHORIZED`, `DEFERRED`, `REJECTED`, `SUPERSEDED`, `CANCELLED`). Stand-alone execution permission removed; `isEligibleForExecutionPlanning()` is true for `DECIDED`, `ORDERED`, and `AUTHORIZED`, allowing graph construction and preparatory work without granting transaction authority. Verified in `tests/intent-and-execution-authority.test.ts`. |
| **AC-001-04**<br>Orthogonal Data Classification (sensitivity separate from origin) | **SATISFIED** | Implemented in `packages/domain/src/common/data-classification.ts`. `DataSensitivityClassification` (PHI/LDS/De-identified/Public) and `DataProvenanceOrigin` (Synthetic/EHR/Manual/Portal/Device) are orthogonal enums. Verified in `tests/domain-clarifications.test.ts`. |
| **AC-001-05**<br>Temporal uncertainty model supports partial/approximate/unknown time | **SATISFIED** | Implemented in `packages/domain/src/common/temporal-window.ts` (`EXACT`, `DATE_ONLY`, `MONTH_ONLY`, `YEAR_ONLY`, `INTERVAL`, `APPROXIMATE`, `UNKNOWN`). Preserves effective clinical time, source-recorded time, ingestion time, and supersession time without manufacturing precision. Verified in `tests/domain-clarifications.test.ts` and `tests/persistence-postgres.test.ts`. |
| **AC-001-06**<br>Extensible Action Concepts (medication and non-medication) | **SATISFIED** | Implemented in `packages/domain/src/intent/intent-action.ts` (`ExtensibleActionConcept`, namespaces, categories, qualifiers, values). Tested for medications, monitoring, procedures, and custom specialty infusion protocols in `tests/domain-clarifications.test.ts`. |
| **AC-001-07**<br>Separate `aggregateVersion` from `schemaVersion` & upcasting support | **SATISFIED** | Implemented across all 5 aggregates via `VersionedAggregateIdentity` and `reconstitute()`. Verified in `tests/domain-clarifications.test.ts` and `tests/persistence-postgres.test.ts` that schema migrations/upcasting do not advance `aggregateVersion`. |
| **AC-001-08**<br>Execution Graph node state vs external attempt state distinction | **SATISFIED** | Implemented in `packages/domain/src/execution/`. External attempt (even ACCEPTED) leaves node in `IN_PROGRESS`. Node completion strictly requires structured `CompletionConfirmation` with verified evidence and external reference ID. Verified in `tests/domain-invariants.test.ts` and `tests/persistence-postgres.test.ts`. |
| **AC-001-09**<br>Authority-ready node semantics & blocked node advancement | **SATISFIED** | `ExecutionNodeState` expanded with `WAITING_ON_DEPENDENCIES`, `WAITING_ON_EVIDENCE`, `AWAITING_AUTHORITY`, `READY_FOR_EXECUTION`. Graphs can advance safe preparatory work while transaction-level Class C nodes remain blocked awaiting authority. Verified in `tests/intent-and-execution-authority.test.ts`. |
| **AC-001-10**<br>Zero untyped domain escape hatches & typed domain events | **SATISFIED** | All domain aggregates use strongly typed properties (no `Record<string, unknown>`). Discriminated domain events defined in `packages/domain/src/events/aggregate-events.ts`. Verified in `tests/domain-clarifications.test.ts`. |
| **AC-001-11**<br>One-way dependency direction (pure domain) | **SATISFIED** | `packages/domain` contains zero imports of Google Cloud, Gemini, Temporal, FHIR, Kysely, Fastify, or external SDKs. Verified by `scripts/verify-architecture.ts` and `tests/architecture.test.ts`. |
| **AC-001-12**<br>PostgreSQL persistence with optimistic concurrency and outbox | **SATISFIED** | Kysely migration `001_initial_canonical_schema.ts` and 5 relational repositories implemented. Tested against live Docker PostgreSQL 16 instance. Optimistic concurrency conflict throwing verified in `tests/persistence-postgres.test.ts`. |
| **AC-001-13**<br>Cross-tenant and cross-patient isolation negative tests | **SATISFIED** | Domain assertions (`assertStrictTenantAndPatientMatch`) and repository queries verified in `tests/domain-invariants.test.ts` and `tests/persistence-postgres.test.ts`. Queries for other tenants or other patients fail closed (return `null` or throw). |

---

## 2. Automated Test Suite Results

```text
 RUN  v2.1.9 /Users/dre/dev/Sovereign

 ✓ tests/intent-and-execution-authority.test.ts (5 tests) 3ms
 ✓ tests/domain-clarifications.test.ts (5 tests) 4ms
 ✓ tests/domain-invariants.test.ts (10 tests) 5ms
 ✓ tests/architecture.test.ts (7 tests) 4ms
 ✓ tests/persistence-postgres.test.ts (11 tests) 223ms

 Test Files  5 passed (5)
      Tests  38 passed (38)
```

- Synthetic Data & PHI Scan (`pnpm run test:phi`): **PASS** (Zero PHI patterns).
- Architecture Constraint Scan (`pnpm run test:arch`): **PASS** (Zero forbidden domain imports; AI direct mutation forbidden).
- TypeScript Typecheck (`pnpm run typecheck` / `pnpm -r exec tsc --noEmit`): **PASS** (0 errors).
- Biome Lint & Format (`pnpm run lint`): **PASS** (0 errors).

---

## 3. Implementation Decisions & ADR Governance

1. **Persistence Shape Decision Governed by ADR-0008:**
   - The PostgreSQL relational storage serializes internal aggregate collections (`assertions_json`, `assessments_json`, `supporting_evidence_ids_json`, `nodes_json`, `associated_*_ids_json`) into typed `jsonb` columns.
   - This was an explicit architectural implementation decision for local v0.1 reference development to ensure transactional consistency and zero join cascades during early development without creating untyped domain escape hatches.
   - Formalized in [`docs/adr/ADR-0008-canonical-aggregate-persistence-shape.md`](file:///Users/dre/dev/Sovereign/docs/adr/ADR-0008-canonical-aggregate-persistence-shape.md), marked as:
     **`ACCEPTED FOR LOCAL V0.1 — REASSESS BEFORE PRODUCTION SCALE`**.
   - If production scale or concurrent node-update contention warrants it, normalization into separate tables (e.g. `execution_nodes`) can occur purely within the persistence layer without altering domain contracts.

2. **Unresolved Clinical Decisions:** NONE. All clinical guidelines remain deferred to WO-003+. Ambiguity is represented by `REQUIRES_CLINICAL_DECISION`.

---

## 4. Founder Gate Determination
 
- **Founder Decision:** **`CLOSED — GO`** (Approved and merged into `main`).
- **Status of WO-002:** Planning authorized on branch `wo/002-tenancy-identity-authority`. Implementation remains on **`HOLD`** until Founder review and approval of the WO-002 implementation plan.
- **PHI Gate Posture:** **`HOLD — NO REAL PHI`** remains strictly in force across all environments.
