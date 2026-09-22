# Deferred Clinical Decisions Register

## Status & Governance

This document records clinical design questions that are explicitly **deferred** from the WO-000 blocking gate to downstream domain work orders. Because WO-000 governs cloud security, privacy, and synthetic architecture boundaries, these clinical specifics do not block the establishment of the local synthetic environment.

In accordance with Sovereign Permanent Doctrine:
> **Clinical ambiguity must be marked `REQUIRES CLINICAL DECISION`, not guessed.**  
> AI agents and engineers must not invent clinical answers to unblock implementation.

---

## Registered Deferred Clinical Decisions

### 1. Clinical Evidence Freshness & Screening Expiration Thresholds
- **Status:** `REQUIRES CLINICAL DECISION`
- **Governing Work Orders:** WO-003 (RA Clinical State Model) & WO-010 (Policy, Authority & Autonomy)
- **Clinical Question:** What are the exact maximum allowable lookback windows for mandatory pre-biologic safety screenings (e.g., QuantiFERON-TB/PPD, Hepatitis B sAg/cAb, Hepatitis C Ab, baseline liver enzymes, and pregnancy tests) before an advanced therapy order can be verified as safe for initiation?
- **Downstream Resolution Milestone:** Formal specialty clinical review during WO-003 schema specification and WO-010 policy authoring.

### 2. Clinical Intent Taxonomy: Consideration vs. Executable Intent
- **Status:** `REQUIRES CLINICAL DECISION`
- **Governing Work Orders:** WO-007 (Clinical Intent Service) & WO-010 (Policy, Authority & Autonomy)
- **Clinical Question:** What exact syntactic, semantic, and structural criteria distinguish a clinician's conversational "consideration" of alternative biologic therapies from a definitive "decision" or "order" requiring Class C authorization and triggering prior authorization work?
- **Downstream Resolution Milestone:** Defined in WO-007 domain intent state machine and verified in WO-010 authority rules.

### 3. Narrative-vs-Structured Clinical Discrepancy Resolution
- **Status:** `REQUIRES CLINICAL DECISION`
- **Governing Work Orders:** WO-004 (Evidence & Provenance) & WO-008 (Verification Engine)
- **Clinical Question:** When unstructured clinic encounter notes document a medication failure or intolerance that is omitted or contradicted by the structured EHR active medication list, how must the verification engine flag and route the conflict without inferring clinical truth?
- **Downstream Resolution Milestone:** Formalized in WO-004 evidence extraction provenance models and WO-008 verification conflict rules (`CONFLICTED` / `REQUIRES CLINICAL DECISION`).

### 4. Patient Matching, Merge and Split Semantics (S1-14)
- **Status:** `PARTIALLY DECIDED 2026-09-22` — three of four blocking questions answered; one open
- **Governing Work Orders:** WO-002B (S1-14 patient-context)
- **Clinical Questions:** Seven, set out in full in `docs/clinical-decisions/S1-14-patient-matching.md`. Four of them block implementation: whether an exact name+DOB+sex match must flag as uncertain rather than auto-link; what may attach to an uncertain patient (specifically, whether a pre-visit brief renders at all); which roles may merge; and whether unmerge/split must exist before real patients.
- **Why it cannot be guessed:** the permissive failure mode is two people's clinical records merging silently, which has no safe recovery. Building split after the fact is materially more expensive than building it now.
- **Downstream Resolution Milestone:** Mark's answers to questions 1, 4, 5 and 6 before S1-14 implementation begins; 2, 3 and 7 may follow as configuration.

