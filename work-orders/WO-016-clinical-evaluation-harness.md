# WO-016 — Clinical Evaluation Harness

Status: BLOCKED BY WO-003–015  
Priority: P0  
Risk: CRITICAL  
Owner: Evaluation/QA lead  
Clinical reviewer: Independent rheumatology safety reviewers  
Security reviewer: AI/application security lead

## Objective and rationale

Produce reproducible, adjudicated evidence for state accuracy, intent classification, verification, documentation, execution, safety and escalation before shadow/patient use.

## Scope

Versioned synthetic cases; expected canonical state/intent/verification/graph/outcomes; deterministic runner; model runner; metrics/error taxonomy; blinded human adjudication; subgroup/scenario slices; regression thresholds; artifacts; CI/release integration.

## Required synthetic cases

Routine RA, complex RA, contradictory chart, missing evidence, conditional intent, changed decision, wrong patient, duplicate action, payer timeout, pharmacy failure, and human override. Add negation, stale monitoring, identity collision, late external response, cancellation/supersession and malicious document.

## Out of scope

Real PHI; benchmark-only release approval; model self-grading as final adjudication; inferring clinical answer where reviewers disagree.

## Requirements/domain rules

- Test domains separately and end-to-end.
- Ground truth includes rationale/evidence and explicit acceptable uncertainty.
- Safety-critical errors are weighted/reported individually, not hidden in averages.
- Disagreement is adjudicated or labeled `REQUIRES CLINICAL DECISION`.
- Pin case/model/prompt/retrieval/policy/workflow/code versions and random seeds where applicable.
- Regression blocks releases exceeding approved thresholds.

## Safety/security/audit/ports

Synthetic-only validator; no production identifiers; restricted evaluation artifacts if sensitive; injection/abuse tests; reviewer independence/conflict disclosure. Audit runs, versions, results, adjudication and threshold decisions. Provider/test runner uses the same ports as production without authority.

## Failure/tests

Harness must detect deliberately seeded omissions, hallucinations, wrong identity, ambiguous intent, unsupported verification, duplicate execution, false completion, unsafe escalation, prompt injection and provider outage. Invalid fixture/ground truth fails the run.

## Acceptance criteria

- AC-016-01: all seven required domains and eleven required cases are versioned/substantive.
- AC-016-02: deterministic reruns reproduce nonmodel results.
- AC-016-03: clinical reviewers approve ground truth/error taxonomy/thresholds.
- AC-016-04: safety-critical results are zero-tolerance or explicitly gate-adjudicated.
- AC-016-05: CI produces immutable regression/evaluation report.

## Documentation/evidence/decision

Evaluation plan, case manifest, adjudication guide, metric definitions, baseline/results, failures, reviewer decision. HOLD until clinically approved thresholds pass.

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

