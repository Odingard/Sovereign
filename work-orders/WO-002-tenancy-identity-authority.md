# WO-002 — Tenant, Patient, Identity & Authority Model

Status: BLOCKED BY WO-001  
Priority: P0  
Risk: CRITICAL  
Owner: Identity/authorization lead  
Clinical reviewer: Clinical safety lead  
Security reviewer: Security lead

## Objective and rationale

Prove organization isolation, patient identity integrity, and human/service authority. Cloud IAM authenticates infrastructure; it is not the complete tenant/patient authorization model.

## Dependencies/inputs

WO-000/001; tenant/site model; pilot identity sources; roles; action classes; consent and break-glass decisions.

## Scope

Organization/site/membership; user/service identity; session; role and attribute grants; patient identifiers/matching/reconciliation; purpose/action/resource authorization; delegation/expiry/revocation; exact-content approval; service principals; background-job context; admin and support access.

## Out of scope

Treatment decisions; general enterprise HR; automatic patient merge; AI-created identity or grant; treating infrastructure role as clinical authority.

## Requirements and rules

- Trusted tenant context comes from authenticated membership, never request data alone.
- Every repository/query/cache/object/job/event/export carries tenant scope.
- Patient match confidence cannot silently merge identities; ambiguity requires human reconciliation.
- Authority evaluates actor, role/grant, tenant, patient, purpose, action class, evidence, state, content hash, conditions, policy version, and time.
- AI principals cannot hold clinician roles, approve own outputs, or use break-glass.
- Approval invalidates on content/patient/action change, expiry, revocation, or supersession.

## Safety/security/audit/ports

Deny by default; MFA/session revocation; least privilege; anti-IDOR; support JIT access; dual control for sensitive configuration. Audit authentication, selection, access, denial, grant/revoke, reconciliation, approval, and break-glass. Define IdP, directory, policy-decision, patient-master, consent, and audit ports.

## Failure/tests

Missing/ambiguous tenant/patient/authority blocks. Test horizontal/vertical privilege escalation, cross-tenant search/cache/files/jobs/analytics, confused deputy, stale approval, revoked role, duplicate patient, bulk partial authorization, and support access.

## Acceptance criteria

- AC-002-01: tenant matrix and automated isolation suite cover every storage/compute path.
- AC-002-02: patient reconciliation never permits AI merge/split/reassignment.
- AC-002-03: clinical/business authority remains separate from IAM.
- AC-002-04: direct/bulk/background actions reauthorize at execution.
- AC-002-05: denials are reason-coded and audited without leaking data.

## Documentation/evidence/decision

Identity/authority diagrams, roles/actions matrix, threat tests, reconciliation UX, audit samples, reviewer report. **HOLD** on any wrong-patient/cross-tenant or authority bypass; GO only after independent security and clinical approval.

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

