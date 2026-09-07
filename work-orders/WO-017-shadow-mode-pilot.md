# WO-017 — Shadow-Mode Design Partner Pilot

Status: BLOCKED BY WO-000–016  
Priority: P0  
Risk: CRITICAL  
Owner: Pilot program lead  
Clinical reviewer: Design-partner clinical lead  
Security reviewer: Production security/privacy lead

## Objective and rationale

Compare Sovereign proposals against actual clinician decisions, staff workflows, and outcomes without allowing autonomous care actions. Validate workflow fit and safety before controlled activation.

## Scope

Approved partner/environment/cohort; onboarding/training; bounded data use after explicit PHI gate; proposed Clinical State, delta brief, note, Clinical Intent, exceptions, Execution Graph, expected next actions; blinded/time-aligned comparison; discrepancy review; workflow/latency/reliability/usability metrics; incident/stop rules.

## Out of scope

Autonomous or externally executed care action; model output in legal chart unless separately reviewed/approved workflow; treatment recommendation claims; expansion beyond cohort/integration; general availability.

## Requirements/domain rules

- Shadow outputs cannot mutate authoritative customer/Sovereign production clinical state or invoke external adapters.
- Compare against actual clinician decision, actual staff workflow, and actual outcome with temporal integrity.
- Record missed/late/incorrect predictions, not only matches.
- Clinicians/staff can report harm potential and workflow mismatch.
- Stop rules include wrong patient/tenant, PHI exposure, unsafe recommendation, authority bypass, audit loss, or threshold breach.
- Pilot results cannot be generalized beyond validated scope.

## Safety/security/audit/ports

Explicit bounded WO-000 PHI authorization, contracts, eligible services, minimum access, consent/policy, JIT support, monitoring and retention. Complete audit of source snapshot, output versions, comparisons, reviewers, discrepancies and incidents. Disable all execution ports or replace with non-effect simulator enforced by infrastructure and policy.

## Failure/tests

Prepilot prove no external effect, kill switch, rollback, outage/manual path, tenant/patient isolation, incident response, audit/export, and monitoring. Simulate threshold breach and confirm automatic pause/human notification.

## Acceptance criteria

- AC-017-01: approved protocol defines cohort, duration, measures, thresholds, stop rules and decision owners.
- AC-017-02: technical controls prove zero autonomous care actions.
- AC-017-03: every proposal is compared with time-aligned actual decision/workflow/outcome.
- AC-017-04: discrepancies receive independent clinical adjudication.
- AC-017-05: final report states safety/quality/workflow findings and bounded next-step recommendation.
- AC-017-06: activation requires a new explicit gate; shadow completion grants no autonomy.

## Documentation/evidence/decision

Protocol, approvals, environment proof, training, monitoring, comparisons, adjudications, incidents, metrics, residual risk, final report. Default **HOLD**; founder/clinical/privacy/security reviewers may record bounded GO, continued shadow, redesign, or NO-GO.

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

