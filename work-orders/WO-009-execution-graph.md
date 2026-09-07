# WO-009 — Execution Graph & Durable Workflow

Status: BLOCKED BY WO-007/008  
Priority: P0  
Risk: CRITICAL  
Owner: Workflow lead  
Clinical reviewer: Clinical safety lead  
Security reviewer: Workflow security lead

## Objective and rationale

Persist care execution as a durable dependency graph that survives restarts/days-long waits, retries safely, prevents duplicates, and tracks clinical-objective completion rather than worker success.

## Scope

Graph/node/edge/version; action, evidence, owner, authority, dependencies, timing, status, retry, completion criteria, escalation; create from verified intent; dispatch/wait/reconcile; pause/cancel/supersede; compensation; history; manual tasks; projections.

## Out of scope

LLM plan as graph; vendor workflow history as canonical; direct treatment decision; adapter-specific logic in nodes; task completion automatically meaning therapy completion.

## Requirements/domain rules

- Node states distinguish proposed, blocked, ready, authorized, dispatched, transmitted, received, accepted, waiting, completed, failed, unknown, paused, cancelled, superseded, escalated.
- Only verified intent and current authority can activate consequential nodes.
- Idempotency key and provider-operation record protect every side effect.
- Completion criteria identify required evidence/verifier.
- Cancel/supersede propagates safely; already external actions require reconciliation, not fictional rollback.
- Resume correlation is tenant/patient/graph/node scoped.

## Safety/security/audit/ports

Reauthorize immediately before dispatch; segregate workers; validate state/version; no arbitrary expression execution. Audit graph versions, node transitions, attempts, confirmations, overrides, timers, cancellation and reconciliation. Define workflow scheduler, clock, dispatcher, repository, event, audit ports.

## Failure/tests

Crash before/after commit/send, duplicate worker/event, late/out-of-order confirmation, provider timeout, poison node, clock change, authorization revocation, pause/cancel/supersede, manual intervention. Prove at-most-once logical effect with safely repeatable delivery semantics.

## Acceptance criteria

- AC-009-01: every node contains all required fields and typed lifecycle.
- AC-009-02: restart and multi-day wait resume from durable state.
- AC-009-03: duplicate/replay cannot duplicate external logical action.
- AC-009-04: unknown never collapses to failed or completed.
- AC-009-05: clinical completion requires configured evidence.
- AC-009-06: pause/cancel/supersede/reconciliation tests pass.

## Documentation/evidence/decision

Graph schema/state diagrams, transaction/idempotency design, recovery/compensation runbook, chaos/replay results, audit timeline. NO-GO on duplicate action or false completion.

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

