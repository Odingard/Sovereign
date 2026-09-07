# WO-004 — Clinical Evidence & Provenance

Status: BLOCKED BY WO-001/003  
Priority: P0  
Risk: CRITICAL  
Owner: Evidence service lead  
Clinical reviewer: Clinical safety lead  
Security reviewer: Data security/privacy lead

## Objective and rationale

Make every material executable assertion traceable to attributable source evidence. Clinical truth cannot be reconstructed from fluent output alone.

## Dependencies/inputs

Canonical/RA models; source inventory; retention/integrity policy; synthetic documents/results/messages.

## Scope

Evidence identity; source system/artifact/type; author/organization; patient/tenant; effective, authored, received, extracted, reviewed times; locator; content hash; custody; sensitivity; candidate extraction; human validation; conflict; supersession; packet/claim linking; minimum-necessary retrieval.

## Out of scope

Invented source citations; broad document management; treating model confidence as evidence; overwriting source artifacts; real PHI.

## Requirements/domain rules

- Evidence is immutable or durably referenced with integrity verification.
- Normalized assertions retain exact source linkage/locator where feasible.
- Derived assertions list inputs, method/model/config version, and reviewer disposition.
- Evidence quality/freshness is policy input, not clinical truth.
- Contradictory sources remain visible; resolution is attributable.
- Executable claims without sufficient evidence are blocked and reason-coded.

## Safety/security/audit/ports

Enforce patient/tenant/purpose scope, sensitivity/consent, malware/content checks, least disclosure, authorized export. Audit access, extraction, linkage, validation, conflict resolution, packet inclusion/exclusion, and integrity failure. Define source reader, artifact store, hashing, locator, DLP/scanner, and clock ports.

## Failure/tests

Missing/changed/unreachable/mismatched source, wrong patient, stale evidence, hash mismatch, malicious content, or unsupported assertion fails closed/quarantines. Test byte immutability, source round trip, temporal order, conflict, correction, tampering, access and prompt-injection fixtures.

## Acceptance criteria

- AC-004-01: evidence schema covers identity, provenance, timing, custody, sensitivity, integrity, and supersession.
- AC-004-02: every executable assertion can produce a complete evidence trace or is blocked.
- AC-004-03: conflict/tamper/wrong-patient tests pass.
- AC-004-04: exports are scoped, authorized, audited, and integrity-verifiable.

## Documentation/evidence/decision

Evidence contract, lifecycle, retention/access matrix, threat tests, sample proof bundle, reviewer findings. Default **HOLD** until evidence trace and tamper/isolation tests pass.

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

