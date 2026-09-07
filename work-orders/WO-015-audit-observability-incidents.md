# WO-015 — Audit, Observability & Incident Controls

Status: BLOCKED BY WO-001–014  
Priority: P0  
Risk: CRITICAL  
Owner: Reliability/compliance lead  
Clinical reviewer: Clinical safety lead  
Security reviewer: Security operations lead

## Objective and rationale

Make every material decision/action reconstructable while operating the platform without leaking PHI. Infrastructure logs are not the clinical audit record.

## Scope

Clinical audit schema/store/integrity/export; request/workflow/adapter/model/security metrics/traces/logs; PHI-safe correlation; SLOs/alerts; anomaly detection; access review; incident severity/runbooks; kill switches; evidence preservation; backup/restore; disaster exercise; customer notification support.

## Out of scope

Putting full clinical content into logs; relying on vendor logs as audit; immutable storage without authorized correction/supersession; autonomous incident closure.

## Requirements/domain rules

- Clinical audit answers who, what, when, tenant, patient, evidence, intent, authority, model/version, external result, override and final state.
- Audit is append-only/tamper-evident; correction appends.
- Consequential state/action blocks if durable audit cannot commit.
- Operational telemetry uses opaque correlation IDs and safe codes, not PHI.
- Incidents preserve care continuity/manual workflow and evidence.
- Metrics derive from canonical events with definitions and data freshness.

## Safety/security/audit/ports

Separate audit/read/export roles; retention/legal hold; integrity verification; alert access; JIT support; key separation. Ports for audit sink, integrity anchor, metrics/logs/traces, alerting, backup, incident notification.

## Failure/tests

Audit unavailable, log sink down, corrupt chain, clock skew, duplicate event, high-cardinality storm, restore, regional/service outage, kill switch, wrong-patient alert. Test no PHI leakage, complete timeline, tamper detection and incident tabletop.

## Acceptance criteria

- AC-015-01: representative case reconstructs all required fields end-to-end.
- AC-015-02: telemetry scans show no prohibited PHI/secrets.
- AC-015-03: audit failure blocks consequential operations safely.
- AC-015-04: integrity/export verification and access controls pass.
- AC-015-05: incident, backup/restore and degraded-care exercises pass.

## Documentation/evidence/decision

Audit dictionary, observability map/SLOs, alert/runbook catalog, incident matrix, restore/tabletop reports, sample evidence export. NO-GO on incomplete clinical audit or PHI leakage.

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

