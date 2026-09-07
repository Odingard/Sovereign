# WO-000 — Cloud, Security & PHI Architecture Gate

Status: NOT STARTED  
Priority: P0 / blocking  
Risk: CRITICAL  
Owner: Founder-assigned platform/security lead  
Clinical reviewer: Founder-assigned rheumatology safety lead  
Security reviewer: Founder-assigned security/privacy lead

## Objective and product rationale

Approve a local synthetic architecture and define the exact conditions under which any cloud environment or PHI use may later occur. Sovereign cannot establish clinical trust on an undefined data, identity, vendor, or incident boundary.

## Dependencies and inputs

Repository constitution; founder doctrine; intended use; proposed vendors; pilot/EHR facts; legal/privacy/security/clinical reviewers. No downstream WO is a prerequisite.

## Scope

Document dev/test/staging/prod separation; synthetic environment; PHI boundary/data flows; service eligibility/BAA matrix; U.S. residency; encryption/key ownership/rotation; secrets; logs/traces/support; backups/restore/deletion; tenant/patient isolation; model providers/subprocessors/data use/retention; network/egress; IAM; CI/CD and supply chain; vulnerability management; audit; incident/breach response; business continuity; access review; environment promotion; approval authorities.

## Explicitly out of scope

Real PHI ingestion; clinical features; choosing treatment; production deployment; assuming a Google service is eligible because it is available.

## Functional and domain requirements

- Produce architecture/data-flow/trust-boundary diagrams and a data classification/retention table.
- Separate cloud IAM from Sovereign tenant/patient/business/clinical authority.
- Define eligible/prohibited services and configuration for each data class/environment.
- Local build must operate without cloud credentials.
- Define auditable environment and key separation; production access is just-in-time and approved.
- PHI authorization must name environment, services, purpose, data classes, users, controls, expiry/review—not a blanket GO.

## Safety, security/privacy, audit, and ports

Threat and clinical-hazard analyses include wrong-patient/tenant, model leakage, prompt injection, support access, log leakage, data exfiltration, duplicate action, outage, and recovery. Record every privileged/data/configuration action. Define ports for secrets, storage, database, messaging/workflow, AI, audit, and observability; vendor implementations stay outside core.

## Failure behavior

Unknown eligibility, missing contract, unverified residency, unsafe logging, missing isolation proof, or unresolved critical/high finding yields HOLD/NO-GO. Until GO: synthetic only and no downstream implementation.

## Test requirements

Automated secret/PHI-fixture scans; tenant/wrong-patient threat tests planned; backup/restore and incident tabletop procedures; dependency/SAST/IaC/container/SBOM/provenance pipeline design; local offline bootstrap; evidence that telemetry rejects/redacts PHI.

## Acceptance criteria

- AC-000-01: all environments, trust boundaries, data flows, services, subprocessors, regions, keys, secrets, logs, backups, access, and incidents are documented.
- AC-000-02: an approved service eligibility/BAA/configuration matrix exists.
- AC-000-03: local synthetic bootstrap requires no production/cloud credential.
- AC-000-04: clinical, privacy, security, and founder reviewers sign residual risks.
- AC-000-05: PHI decision is explicitly `NO PHI`, bounded `GO`, or `HOLD`; absence is not GO.
- AC-000-06: CI and repository scans prevent secrets and prohibited datasets.

## Required documentation and completion evidence

ADRs, diagrams, inventories, threat/safety/privacy assessments, access matrix, retention schedule, runbooks, CI design/results, reviewer findings, and signed gate record.

## Go / Hold / No-Go

Default: **HOLD — NO REAL PHI.** GO requires named human approvals and closure/acceptance of all blocking findings.

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

