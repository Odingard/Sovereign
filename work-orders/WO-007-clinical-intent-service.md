# WO-007 — Clinical Intent Service

Status: BLOCKED BY WO-002/004/006  
Priority: P0  
Risk: CRITICAL  
Owner: Intent service lead  
Clinical reviewer: Rheumatology safety lead  
Security reviewer: Application security lead

## Objective and rationale

Persist what a clinician actually expressed and distinguish discussion from executable intent. Misclassifying conversational language can trigger unsafe work.

## Scope

Intent candidate/record, subject/action/therapy, actor, status, conditions, alternatives, rationale/evidence, target/time, authorization, expiry, supersession, review, and link to encounter/state. Statuses: discussion, considered, conditional, recommended, planned, decided, ordered, authorized, deferred, rejected, superseded.

## Out of scope

AI treatment selection; implied decisions; automatic execution; EHR order replacement; collapsing status vocabulary.

## Requirements/domain rules

- Capture exact supporting utterance/note evidence and context.
- Candidate classifier cannot promote itself to decided/ordered/authorized.
- Conditional intent remains nonexecutable until explicit conditions and authority are satisfied.
- Changed decisions supersede/cancel affected downstream work.
- Discussion/considered/recommended/planned/deferred/rejected/superseded/ambiguous states cannot create executable consequences.
- Ambiguity is `REQUIRES CLINICAL DECISION`.

## Safety/security/audit/ports

Exact patient/clinician/encounter identity; role/authority; minimum content; immutable prior versions. Audit candidate, evidence, review, status, authorization, condition resolution, and supersession. Ports: evidence, state, authority, review, repository/outbox/audit.

## Failure/tests

Block missing speaker/identity/evidence, ambiguous negation, conditional details, conflicting plans, stale/revoked authorization, changed content. Tests cover all status transitions, conditional/changed decisions, quoted third-party plans, patient requests versus clinician decisions, and model bypass.

## Acceptance criteria

- AC-007-01: all required statuses have clinically approved definitions/transitions.
- AC-007-02: only appropriate, authorized states can request verification/execution.
- AC-007-03: changed/rejected/superseded intent halts obsolete work safely.
- AC-007-04: synthetic ambiguity evaluation meets approved thresholds.

## Documentation/evidence/decision

Intent schema, state machine, phrase/scenario set, authority matrix, cancellation semantics, audit/test report. HOLD until clinical adjudication confirms executable boundaries.

## Mandatory work-order field index

| Required field | Binding location/content |
| --- | --- |
| Status | Header metadata; must be updated only from acceptance evidence. |
| Priority | Header metadata. |
| Risk | Header metadata and residual-risk gate review. |
| Owner | Header role; assign a named human before execution. |
| Clinical reviewer | Header role; independent named human approval required where applicable. |
| Security reviewer | Header role; independent named human approval required where applicable. |
| Objective | Objective section above. |
| Product rationale | Objective/rationale section above; explains why the control matters to Sovereign. |
| Dependencies | Dependencies/inputs section above; unresolved dependency blocks start. |
| Inputs | Dependencies/inputs section above; inputs must be versioned and attributable. |
| Scope | Scope section above; no silent expansion. |
| Explicitly out of scope | Out-of-scope section above; prohibited work remains prohibited. |
| Functional requirements | Requirements section above and acceptance criteria below it. |
| Domain rules | Domain rules in the requirements section; repository constitution also applies. |
| Safety requirements | Safety controls above plus independent clinical-safety review. |
| Security/privacy requirements | Security/privacy controls above plus WO-000 restrictions. |
| Audit requirements | Audit controls above; consequential work requires durable audit. |
| Adapter/port requirements | Ports/adapters section above; core remains provider independent. |
| Failure behavior | Failure section above; identity/evidence/authority ambiguity fails closed. |
| Test requirements | Test section above; synthetic positive, negative, replay and failure tests required. |
| Acceptance criteria | Numbered AC list above; every item requires objective evidence. |
| Required documentation | Documentation/evidence section above. |
| Completion evidence | Documentation/evidence section; self-report is insufficient. |
| Go / Hold / No-Go decision | Final decision statement above; only designated humans approve GO. |

