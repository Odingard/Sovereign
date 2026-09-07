# WO-008 — Verification Engine

Status: BLOCKED BY WO-003/004/006/007  
Priority: P0  
Risk: CRITICAL  
Owner: Verification lead  
Clinical reviewer: Clinical safety lead  
Security reviewer: Security lead

## Objective and rationale

Independently determine whether a proposed mutation or execution is sufficiently supported and internally consistent. Generation and verification cannot be the same unexamined model assertion.

## Scope

Typed verification request/result/rules; evidence conflict, missing evidence, unsupported assertion, ambiguous intent, stale evidence, inconsistent execution state, missing authority; severity; blockers; remediation; rule/config version; deterministic and approved model-assisted checks; re-verification.

## Out of scope

Clinical judgment, authority grant, treatment selection, direct mutation/execution, hiding unresolved conflict.

## Requirements/domain rules

- Verify trusted tenant/patient/current object versions at decision time.
- Results are `VERIFIED`, `BLOCKED`, `INCONCLUSIVE`, or `REQUIRES_CLINICAL_DECISION`, with reason codes and evidence.
- Inconclusive never equals pass. Expired/stale evidence invalidates prior verification as configured.
- Verification result binds exact action/content/intent/evidence/policy versions.
- High-risk checks are deterministic or independently reviewed; the proposer cannot self-verify.

## Safety/security/audit/ports

Least necessary evidence; injection-resistant parsing; no secret/PHI in diagnostics. Audit request, rules, inputs, result, reviewer/override, expiry. Ports: evidence/state/intent/authority readers, rule registry, independent model evaluator, audit.

## Failure/tests

Unavailable verifier, rule error, source mismatch, changed input, conflict, missing authority, stale evidence, inconsistent graph, or audit failure blocks. Test each required detector, proposer/verifier independence, replay, override limits, and false-pass adversarial cases.

## Acceptance criteria

- AC-008-01: all seven required conditions have reason-coded tests.
- AC-008-02: exact-version binding and invalidation are proven.
- AC-008-03: no `INCONCLUSIVE`/error path becomes verified.
- AC-008-04: verifier cannot mutate state or execute.
- AC-008-05: clinical/security reviewers approve override policy.

## Documentation/evidence/decision

Rule catalog, contracts, decision tables, adversarial results, overrides, SLO/failure runbook, audit examples. GO requires zero known fail-open paths.

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

