# ADR-0011: Specialty Clinical State Modeling via Composable Canonical Assertions and Rebuildable Projections

## Status
ACCEPTED FOR V0.1

## Date
2026-09-08

## Context
Sovereign requires specialty-specific clinical models, beginning with adult Rheumatoid Arthritis (RA).
A critical architectural risk is the temptation to create parallel, specialty-specific aggregate roots (e.g. `RaPatientStateAggregate`) or separate specialty databases.
Creating a sixth authoritative aggregate for RA would:
- Violate Tenet 3 ("The model is not the system of record") by fracturing authoritative state;
- Permit silent synchronization drift between generic `ClinicalStateAggregate` and the specialty model;
- Tightly couple canonical domain machinery to specialty-specific disease concepts;
- Require rewriting core persistence, auditing, and multi-tenancy machinery for every new disease (e.g. PsA, AxSpA, JIA).

## Decision
1. **The Five Authoritative Aggregates Remain Unchanged:**
   `ClinicalStateAggregate`, `ClinicalEvidenceAggregate`, `ClinicalIntentAggregate`, `ExecutionGraphAggregate`, and `TherapyAccessStateAggregate` remain the sole authoritative aggregate roots in Sovereign. Rheumatoid Arthritis is **NOT** a sixth aggregate.
2. **Canonical Assertions as Ground Truth:**
   All specialty clinical facts are represented solely as atomic, typed canonical `ClinicalAssertion` objects within `ClinicalStateAggregate`, referencing immutable `ClinicalEvidenceAggregate` provenance.
3. **Specialty Package Isolation:**
   Specialty models reside in isolated packages (e.g., `packages/specialties/rheumatology/ra/`). The dependency direction is strictly one-way: `specialties -> canonical domain`. Canonical domain has zero imports of, or knowledge of, specialty packages.
4. **Strictly Read-Only, Non-Authoritative, Rebuildable Projections:**
   Specialty profiles (such as `AdultRaClinicalProfile`) exist exclusively as read-only compositions and projections over `ClinicalStateAggregate`. They are 100% rebuildable from canonical assertions. An edited projection cannot directly mutate clinical truth.
5. **Authorized Mutation Path:**
   To assert new RA clinical facts, domain services validate inputs and evidence provenance, construct canonical `ClinicalAssertion` instances, and append them through `ClinicalStateAggregate.appendAssertion()`.

## Consequences
- **Positive:** Preserves the canonical system-of-record architecture without aggregate divergence.
- **Positive:** Generic domain remains completely unpolluted by specialty clinical guidelines.
- **Positive:** Establishes a scalable pattern for future specialty packages (PsA, AxSpA, JIA, Oncology).
- **Negative:** Specialty reads require projecting canonical assertions into domain profiles, requiring deterministic projection logic.
