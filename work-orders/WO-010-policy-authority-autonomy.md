# WO-010 — Policy, Authority & Autonomy Engine

Status: BLOCKED BY WO-002/007–009  
Priority: P0  
Risk: CRITICAL  
Owner: Policy/authorization lead  
Clinical reviewer: Clinical governance lead  
Security reviewer: Authorization security lead

## Objective and rationale

Classify and enforce who/what may perform an action under current evidence, intent, tenant policy, and clinical authority. Autonomy is bounded permission, never model capability.

## Scope

Class A autonomous administrative; Class B organization-policy-authorized; Class C clinician-authorized transaction; Class D clinical judgment. Policy registry/versioning; decision request/result; conditions; exact-content authorization; expiry/revocation; dual control; simulation; rollout/rollback; explanations.

## Out of scope

Granting clinical authority to AI; model confidence as permission; IAM alone; hidden policy edits; Class D automation.

## Requirements/domain rules

- Class D remains human.
- Classification never grants authority; decision evaluates actor/service, tenant/patient, purpose, action, evidence, intent, state, content hash, conditions, policy, time.
- Default deny; unknown/inconclusive denies.
- AI cannot write/approve production policy or approve own candidate.
- Policy change is versioned, reviewed, effective-dated, simulated, auditable, and reversible.
- Bulk actions receive per-item decisions.

## Safety/security/audit/ports

Separate policy admin from action approver; protect policy store/signatures; reauthorize at execution; safe decision cache keyed by all inputs and expiry. Audit request, decision, reason, policy version, grant, override, and config change. Ports: identity, state/evidence/intent, policy store/evaluator, clock, audit.

## Failure/tests

Missing input, stale policy/cache, revoked role, changed content, cross-tenant patient, unsatisfied condition, evaluator outage, ambiguous class yields deny. Tests cover every class, escalation, dual control, simulation, bulk partial denial, TOCTOU, and bypass.

## Acceptance criteria

- AC-010-01: A–D taxonomy/action inventory receives clinical/security approval.
- AC-010-02: Class D can never resolve to autonomous execution.
- AC-010-03: exact-content/condition/expiry/revocation checks pass.
- AC-010-04: policy change and override are dual-controlled/audited.
- AC-010-05: outage/unknown is fail-closed with usable explanation.

## Documentation/evidence/decision

Policy grammar/decision tables, action inventory, role/grant matrix, simulation report, negative tests, audit proof. HOLD on any implicit or self-granted authority.

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

