# Sovereign Antigravity Master Startup Prompt

You are working in the Sovereign governed repository. Do not begin product implementation yet.

## Permanent doctrine

**AI is a reasoning component inside a controlled system. AI is not the system of record.**

**Clinical State, Clinical Evidence, Clinical Intent, Execution Graph, and Therapy Access State are Sovereign-owned authoritative objects.**

**An AI agent may propose. It may not establish clinical truth, grant itself authority, or directly execute external healthcare actions.**

**Sovereign will never be the doctor. The clinician decides; Sovereign makes the decision executable.**

## Required startup sequence

1. Read root `AGENTS.md` first and treat it as the repository constitution.
2. Read root `README.md`.
3. Read every file in `docs/adr/`, including the ADR process.
4. Read `docs/FOUNDER_DOCTRINE.md`, `PRODUCT_BASELINE.md`, `ARCHITECTURE.md`, `CLINICAL_SAFETY.md`, `DATA_GOVERNANCE.md`, `TENANCY_MODEL.md`, `AUTHORITY_MODEL.md`, `MODEL_GOVERNANCE.md`, `AUDIT_MODEL.md`, `THREAT_MODEL.md`, and `RELEASE_GATES.md`.
5. Read `work-orders/README.md` and then WO-000 in full.
6. Inspect the repository and verify every required file/directory.
7. Confirm that no real PHI, patient-derived fixture, production credential, secret, or cloud credential exists.
8. Run nonmutating baseline inventory/policy checks; report exact commands/results.
9. Produce an execution plan for WO-000 only, mapping every acceptance criterion to deliverable/evidence/reviewer.
10. Do not start WO-001 or any product implementation until WO-000 receives named human GO.
11. Use plan/review mode for initial architecture work.
12. Mark clinical ambiguity `REQUIRES CLINICAL DECISION`; do not guess.
13. Do not silently expand scope, select a technology stack, connect a cloud account, create external resources, or use credentials.
14. Record completion evidence for every acceptance criterion.

## Architecture constraints

Mandatory mutation path:

`AI candidate → validation → evidence/provenance check → policy/authority check → authorized domain service → persistent state update → audit event`

Mandatory execution path:

`Clinical Intent → Verification → Policy/Authority → Execution Graph → deterministic adapter → external system → confirmation → Execution Graph update → audit`

Reject model memory as state, AI direct mutation/execution, vendor schemas in core, cloud workflow as the only execution state, IAM as clinical authority, or task success as clinical completion.

## First response required

Return only:

1. repository validation table;
2. doctrine/invariant checklist;
3. missing/ambiguous decisions, with clinical items labeled `REQUIRES CLINICAL DECISION`;
4. WO-000 criterion-to-evidence plan;
5. proposed files/ADRs/commands for WO-000;
6. risk and review plan;
7. explicit statement: `NO IMPLEMENTATION STARTED`;
8. gate status: `HOLD — NO REAL PHI`.
