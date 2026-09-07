# Sovereign Build Program

## Sequence and gate rule

WO-000 is first and blocking. WO-001 may not start until WO-000 has an approved execution plan and formal GO for the permitted environment. No real PHI is allowed until WO-000 explicitly authorizes a bounded environment/use. Subsequent work proceeds in dependency order; parallel work requires documented nonoverlap and cannot bypass a gate.

| WO | Title | Primary exit |
| --- | --- | --- |
| 000 | Cloud, Security & PHI Architecture Gate | approved synthetic architecture; explicit PHI decision |
| 001 | Canonical Domain Model | five authoritative objects/contracts |
| 002 | Tenancy, Identity & Authority | isolation and authority proof |
| 003 | RA Clinical State Model | clinically reviewed state schema |
| 004 | Evidence & Provenance | traceable executable assertions |
| 005 | EHR/FHIR Ingestion | one EHR mapped safely |
| 006 | Clinical State Service | governed candidate mutation |
| 007 | Clinical Intent Service | executable intent semantics |
| 008 | Verification Engine | blockers/conflicts detected |
| 009 | Execution Graph | durable/replay-safe workflow |
| 010 | Policy, Authority & Autonomy | A–D action enforcement |
| 011 | AI Reasoning Layer | replaceable candidate generation |
| 012 | Clinician/Operations/Admin UX | responsibility-preserving experience |
| 013 | Advanced Therapy Access | initiation/continuity loop |
| 014 | External Execution Adapters | deterministic governed effects |
| 015 | Audit/Observability/Incidents | reconstructable and operable system |
| 016 | Clinical Evaluation Harness | synthetic safety/quality evidence |
| 017 | Shadow-Mode Pilot | design-partner comparison, no care actions |

## Required execution record

Every WO PR and walkthrough must preserve these sections: Status, Priority, Risk, Owner, Clinical reviewer, Security reviewer, Objective, Product rationale, Dependencies, Inputs, Scope, Explicitly out of scope, Functional requirements, Domain rules, Safety requirements, Security/privacy requirements, Audit requirements, Adapter/port requirements, Failure behavior, Test requirements, Acceptance criteria, Required documentation, Completion evidence, and Go/Hold/No-Go decision.

Owners/reviewers must be named people before execution. Role labels in source are assignments to resolve, not permission for an agent to self-approve.

## Completion standard

Each acceptance criterion maps to an artifact: test output, evaluation report, threat/safety review, migration proof, screenshot using synthetic data, runbook exercise, contract/schema, or reviewer decision. `Done` without evidence is `HOLD`. Unknown clinical behavior is `REQUIRES CLINICAL DECISION`.

