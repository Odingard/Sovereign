# WO-001 — Sovereign Canonical Domain Model

Status: BLOCKED BY WO-000  
Priority: P0  
Risk: CRITICAL  
Owner: Domain architecture lead  
Clinical reviewer: Rheumatology safety lead  
Security reviewer: Security architecture lead

## Objective and rationale

Define and persist Clinical State, Clinical Evidence/Provenance, Clinical Intent, Execution Graph, and Therapy Access State independently of EHR, FHIR, UI, cloud, workflow vendor, and model provider. These objects prevent external systems and probabilistic models from becoming authority.

## Dependencies and inputs

WO-000 GO; ADR-0001/0002; founder doctrine; synthetic RA scenarios; initial one-EHR inventory.

## Scope

Typed aggregates/identifiers/value objects; tenant/patient scoping; lifecycle/state transitions; invariants; versions/concurrency; provenance references; correction/supersession; event contracts; repositories/ports; relational schema/migrations; serialization/version compatibility; reason/error codes.

## Explicitly out of scope

FHIR resource persistence as domain; AI prompts; UI; vendor adapters; clinical guideline encoding beyond reviewed state vocabulary; external execution.

## Functional/domain rules

- All five objects persist without model/session state and use stable opaque IDs.
- Unknown, absent, negative, conflicted, stale, invalidated, and superseded are distinct.
- Tenant/patient identity is immutable after creation except a separate human reconciliation workflow.
- Clinical Intent is not inferred into an executable state by persistence code.
- Execution Graph task success cannot establish clinical completion without completion evidence.
- Changes use explicit command, expected version, validation, domain event, and audit reference.

## Safety, security/privacy, audit, ports

No free-form blob may bypass typed invariants. Repositories require tenant scope. Sensitive fields/classes are labeled. Audit records creation, attempted/accepted/rejected transitions, actor/authority, evidence, and prior/new versions. Provide storage, clock, ID, transaction, outbox, and audit ports.

## Failure behavior and tests

Reject missing tenant/patient, stale version, invalid transition, untraceable executable assertion, or unknown schema version. Test constructors/invariants, allowed/forbidden transitions, concurrency, migrations/rollback, round-trip serialization, event replay, cross-tenant access, correction/supersession, and provider independence.

## Acceptance criteria

- AC-001-01: five aggregate contracts and lifecycle diagrams exist.
- AC-001-02: relational schema/migrations and repository ports pass synthetic persistence tests.
- AC-001-03: dependency tests prove no UI/EHR/FHIR/cloud/AI SDK enters domain.
- AC-001-04: unknown/negative/conflict/supersession semantics pass clinical review.
- AC-001-05: concurrent and cross-tenant mutations fail safely and auditably.

## Documentation, evidence, decision

Domain glossary, ER/state diagrams, schemas, invariants, migration/replay results, threat/safety review, test report. Default **HOLD** until all five objects and reviews pass; then named reviewers may record GO.

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

