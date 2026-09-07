# WO-003 — Rheumatoid Arthritis Clinical State Model

Status: BLOCKED BY WO-001/002  
Priority: P0  
Risk: CRITICAL  
Owner: Clinical domain lead  
Clinical reviewer: Licensed rheumatology lead  
Security reviewer: Data security lead

## Objective and rationale

Define a clinically reviewed RA state representation that supports longitudinal understanding and execution without inventing ambiguity or embedding a treatment algorithm.

## Inputs/dependencies

Canonical model; identity/provenance; clinician-approved terminology/guidelines; synthetic routine/complex/contradictory cases.

## Scope

Diagnosis/assertion status; disease activity; function; manifestations; objective evidence; medication history; response/failure/intolerance and reason; safety screening; monitoring; current therapy; unresolved plan; therapy access; effective/recorded time; source; certainty/conflict/staleness.

## Out of scope

Autonomous diagnosis, treatment selection, guideline enforcement, inferred negative findings, broad non-RA specialty model, raw FHIR as state.

## Requirements/domain rules

- Each material item links to evidence and distinguishes patient report, clinician assessment, measured result, external record, and derived candidate.
- Diagnosis status is explicit; mention/history/billing code alone does not equal confirmed active RA.
- Medication exposure, response, failure, intolerance, contraindication, nonadherence, access failure, and unknown reason are distinct.
- Disease-activity instruments retain instrument/version/components/time; do not compare incompatible measures silently.
- Missing screening/monitoring is unknown, not negative/completed.
- Conflicts coexist until resolved; corrections/supersession preserve history.
- Clinical ambiguity is `REQUIRES CLINICAL DECISION`.

## Safety/security/audit/ports

Clinical review owns terminology/invariants. Minimum-necessary views and sensitive-data tags apply. Audit source/candidate/review/state transition. Ports accept canonical evidence and output validated candidates/errors, not EHR/vendor objects.

## Failure/tests

Reject unsupported asserted state, impossible temporal ordering, incompatible units, missing identity/source, or invalid status. Synthetic tests cover routine/complex RA, contradiction, missing data, negation, changed diagnosis/therapy, access-vs-clinical failure, and stale monitoring.

## Acceptance criteria

- AC-003-01: all candidate domains have typed schema, vocabulary, uncertainty, temporal, and provenance rules.
- AC-003-02: clinician reviewers approve distinctions and prohibited inference list.
- AC-003-03: synthetic golden cases and adversarial cases pass.
- AC-003-04: model supports current and historical truth without destructive overwrite.
- AC-003-05: no state field grants execution authority.

## Documentation/evidence/decision

Clinical data dictionary, state diagrams, mappings, synthetic cases, adjudication report, known gaps. **HOLD** for unresolved clinical semantics; reviewer records `REQUIRES CLINICAL DECISION` rather than engineering assumptions.

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

