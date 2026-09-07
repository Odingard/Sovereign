# WO-006 — Clinical State Service

Status: BLOCKED BY WO-001–005  
Priority: P0  
Risk: CRITICAL  
Owner: Clinical-state engineering lead  
Clinical reviewer: Rheumatology safety lead  
Security reviewer: Application security lead

## Objective and rationale

Create the only authorized service boundary for establishing/updating Clinical State. AI may submit `StateUpdateCandidate`; it may not submit authoritative mutations.

## Scope/dependencies/inputs

Canonical/RA/evidence/identity contracts, ingestion candidates, human corrections. Implement candidate validation, evidence checks, conflict handling, review workflow, deterministic transition commands, versioning, repository/outbox/audit, queries, correction/supersession.

## Explicitly out of scope

Treatment selection; intent/execution; direct model/database writes; resolving clinical ambiguity by confidence threshold; UI-specific state.

## Requirements/domain rules

- Commands include trusted tenant/patient, actor/authority, candidate, evidence, expected version, purpose, and idempotency key.
- Automated acceptance is allowed only for explicitly approved nonjudgmental mappings; clinical assertions require configured review.
- Unknown is not negative; conflicts are persisted and surfaced.
- Human correction is attributable and does not erase source/model candidate.
- Database permission prevents AI/adapters from writing state tables directly.

## Safety/security/audit/ports

Enforce evidence, authorization, concurrency, schema, temporal and clinical rules. Audit submitted/accepted/rejected/reviewed candidates and mutations with versions/reasons. Ports: repository, unit/terminology validator, evidence, policy, transaction/outbox, audit.

## Failure/tests

Block wrong tenant/patient, absent source, unsupported assertion, stale version, ambiguity, conflict requiring review, invalid transition, audit/outbox failure. Test bypass attempts, deterministic replay, concurrency, correction/supersession, denial reasons, and restart.

## Acceptance criteria

- AC-006-01: no caller other than authorized service can persist Clinical State.
- AC-006-02: `StateUpdateCandidate` never carries implicit authority.
- AC-006-03: all state changes have evidence, actor, reason, prior/new version, audit.
- AC-006-04: synthetic error/ambiguity/conflict tests pass clinical review.

## Documentation/evidence/decision

API/commands, transition table, DB privileges, sequence diagrams, test/eval/audit proof. **NO-GO** on any direct AI/adaptor mutation path.

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

