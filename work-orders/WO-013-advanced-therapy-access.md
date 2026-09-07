# WO-013 — Advanced Therapy Access & Continuity

Status: BLOCKED BY WO-006–012  
Priority: P0  
Risk: CRITICAL  
Owner: Therapy access product lead  
Clinical reviewer: Rheumatology/infusion clinical lead  
Security reviewer: Healthcare integration security lead

## Objective and rationale

Track advanced therapy from explicit intent through actual initiation and continuity, or intentional plan change/cancellation. PA submission is an intermediate event, not the endpoint.

## Scope

New initiation; switch; renewal; additional information; denial/appeal; peer-to-peer; payer/formulary disruption; pharmacy/infusion routing; prerequisite/safety evidence; patient action; shipment/scheduling; initiation/administration confirmation; therapy interruption; continuity monitoring; intentional closure.

## Out of scope

Autonomous therapy choice; guarantee of coverage/clinical outcome; general claims/billing; vendor portal logic in domain; equating approval, shipment, or appointment with initiation.

## Requirements/domain rules

- One idempotent Therapy Access State per patient/therapy/episode with explicit lineage to intent.
- States distinguish evidence preparation, review, submission attempt/transmission/receipt/acceptance, pending, info required, approved/denied/appeal, fulfillment, patient readiness, initiation, interruption, and closure.
- Source/effective date accompanies payer/formulary rules; unknown requirement triggers verification.
- Submitted packet is immutable/versioned; new evidence creates a new approved version.
- Switch/cancel/supersede halts obsolete work and reconciles already-sent actions.
- Final completion requires verified initiation/administration or authorized intentional plan closure.

## Safety/security/audit/ports

Minimum necessary packet; patient/tenant/consent; exact approval; prerequisite blockers; protected appeals. Audit every state, evidence version, owner, deadline, external reference/result, override and completion. Use payer/ePA/pharmacy/infusion/communications ports only.

## Failure/tests

Payer timeout, denial, missing/stale evidence, duplicate submission, late approval after cancellation, pharmacy failure, missed infusion, patient unreachable, formulary/payer change, interruption, wrong patient, human override. Preserve unknown/external waiting accurately.

## Acceptance criteria

- AC-013-01: all required initiation/switch/renewal/disruption paths have approved state models.
- AC-013-02: duplicate/replay cannot create duplicate submission/order.
- AC-013-03: no intermediate external state equals therapy initiation/completion.
- AC-013-04: changed decisions cancel/supersede/reconcile safely.
- AC-013-05: command center exposes owner/blocker/deadline/next permitted action.

## Documentation/evidence/decision

State/sequence diagrams, payer packet/version model, pathway fixtures, exception/escalation rules, metrics, synthetic end-to-end evidence. GO requires clinical and operations approval of terminal-state correctness.

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

