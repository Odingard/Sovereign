# WO-005 — EHR/FHIR Ingestion

Status: BLOCKED BY WO-002/003/004  
Priority: P0  
Risk: HIGH  
Owner: Integration lead  
Clinical reviewer: Clinical informatics lead  
Security reviewer: Integration security lead

## Objective and rationale

Ingest a bounded dataset from one selected EHR through explicit mapping while preserving source semantics and preventing transport data from becoming canonical truth.

## Dependencies/inputs

Approved one-EHR selection/capability matrix; FHIR/vendor sandbox; canonical/RA/evidence contracts; synthetic patients.

## Scope

Authentication, capability discovery, incremental/backfill ingestion, patient/encounter/condition/medication/allergy/observation/report/document mappings required by initial scenarios, pagination, rate limits, event/polling, deduplication, source/version/deletion handling, quarantine, reconciliation, health.

## Out of scope

Multiple EHRs; broad write-back; treating FHIR as canonical clinical state; silent semantic mapping; real PHI; AI resolving identity.

## Requirements/domain rules

- FHIR is transport, not canonical state.
- Raw/source reference and mapping version accompany every normalized candidate.
- EHR identifiers are source-qualified; tenant/patient mapping is validated.
- Missing field remains unknown; status/negation/units/time are mapped explicitly.
- Deletes/corrections/supersession never erase established audit/history.
- Adapter emits candidates; Clinical State Service decides mutations.

## Safety/security/audit/ports

Least SMART/vendor scopes; secrets isolation; allowlisted endpoints; TLS; SSRF/redirect controls; token redaction; bounded files; DLP/log policy. Audit source reads, mapping/quarantine, retry, reconciliation, and accepted/rejected candidates. Implement EHR/FHIR ports and fixture adapter.

## Failure/tests

Bad identity, unsupported resource/profile, ambiguous mapping, invalid unit/time, pagination loop, 401/403/429/5xx, timeout, out-of-order update, duplicate/deletion, poison document, and webhook replay fail safely. Test deterministic replay and no duplicate state.

## Acceptance criteria

- AC-005-01: one EHR capability/mapping matrix is clinically reviewed.
- AC-005-02: synthetic backfill/incremental ingestion is replay-safe and source complete.
- AC-005-03: no vendor/FHIR types leak into core domain.
- AC-005-04: identity, auth, egress, rate, outage, and quarantine tests pass.
- AC-005-05: unsupported semantics remain unknown/review-required.

## Documentation/evidence/decision

Mapping guide, scopes, sequence diagrams, fixtures, conformance/replay/security results, known unsupported fields. GO is limited to the named adapter/scope.

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

