# WO-012 — Clinician / Operations / Admin Experience

Status: BLOCKED BY WO-006–011  
Priority: P0  
Risk: HIGH  
Owner: Product experience lead  
Clinical reviewer: Practicing clinician lead  
Security reviewer: Application security/privacy lead

## Objective and rationale

Create role-specific experiences that expose evidence, uncertainty, responsibility, state, and safe next action. **Zero unnecessary clicks, not zero clinical responsibility.**

## Scope

Clinician: pre-visit delta, encounter capture, source/exception resolution, exact authorization. Operations: work queue, Therapy Access State, blockers, aging, escalation, case dossier. Admin: roles, permissions, policy/autonomy, model/configuration, audit, integration health, performance. Accessibility/responsiveness/error/degraded states.

## Out of scope

Business logic/authority in UI; hidden bulk approval; model chat as primary record; final visual brand beyond functional system; patient app unless separately approved.

## Requirements/domain rules

- UI reads canonical projections and issues typed commands; server revalidates.
- Candidate/fact/conflict/unknown/decision/authorization/attempt/confirmation/completion are visually distinct.
- Every consequential action shows patient, action, evidence, intent, authority requirement, conditions and content version.
- Queue priority is deterministic/reason-coded; no fabricated urgency.
- Bulk action authorizes each record; partial failure remains truthful.
- Deep links preserve authorized context, never tenant/patient identifiers as authority.

## Safety/security/audit/ports

WCAG 2.2 AA target; no PHI in URLs/analytics/error tools; session/privacy controls; reauthentication for high-risk actions; safe notification previews. Audit views, reviews, authorizations, overrides, exports, configuration and impersonation/support access. Typed API/client ports only.

## Failure/tests

Loading/empty/error/stale/degraded/unauthorized/partial results; double click; stale tab/version; role change; cross-tenant URL; browser back; integration outage. Browser tests use synthetic data and confirm no hidden authority elevation.

## Acceptance criteria

- AC-012-01: all three experiences cover required functions with canonical data.
- AC-012-02: usability study confirms users understand draft/authority/completion states.
- AC-012-03: no client code grants authority or fabricates operational state.
- AC-012-04: accessibility, tenant, stale-state, double-action, and degraded-mode tests pass.
- AC-012-05: physician partners approve responsibility-preserving workflow.

## Documentation/evidence/decision

Information architecture, component/API map, prototypes, usability/accessibility report, browser evidence, screenshots, known limitations. HOLD if UX promotes rubber-stamping or hides uncertainty.

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

