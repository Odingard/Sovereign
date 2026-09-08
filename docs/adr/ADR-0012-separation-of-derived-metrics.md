# ADR-0012: Separation of Derived Clinical Metrics from Source Observations in Rheumatology

## Status
ACCEPTED FOR V0.1

## Date
2026-09-08

## Context
Rheumatoid Arthritis management relies on composite disease-activity scores (such as CDAI, SDAI, DAS28-ESR, DAS28-CRP).
A frequent failure mode in clinical software is storing a composite score as a flat numeric value without retaining its constituent source components, the specific calculation formula version, or whether required components were missing.
Furthermore, software frequently blurs the boundary between:
1. Directly observed clinical findings (e.g. swollen joint count);
2. Deterministic mathematical derivations (e.g. CDAI = 22.0);
3. Categorical clinical interpretations (e.g. "High Disease Activity").

Treating a derived score as an unexplainable primary observation or silently imputing missing components violates clinical safety and epistemic honesty (Tenet 7: "Unknown is not negative").

## Decision
1. **Four-Stage Derivation Provenance:**
   Every derived metric preserves an explicit four-stage lineage:
   `Source Observations` $\longrightarrow$ `Calculation Definition & Version` $\longrightarrow$ `Derived Value` $\longrightarrow$ `Optional Approved Interpretation`.
2. **Component Separation & Immutability:**
   Constituent observations (TJC28, SJC28, PtGA, PhGA, ESR, CRP) remain stored as independent, un-mutated canonical assertions with individual `EvidenceId`s.
3. **Explicit NOT_CALCULABLE State:**
   If any mandatory component is missing or unassessed, the derivation engine **MUST NOT** impute a zero, average, or estimated value. The engine must return an explicit `NOT_CALCULABLE` result detailing the missing components.
4. **Decoupling of Numeric Scores from Categorical Interpretation:**
   Mathematical calculation is decoupled from categorical classification. Assigning clinical meaning (e.g. "Remission" vs "Low Activity") is governed by the RA Clinical Decision Register and requires human specialist approval (`REQUIRES_CLINICAL_DECISION`).
5. **Traceability:**
   Every derived result stores the exact array of `sourceComponentAssertionIds` from which it was computed.
6. **Structural Representation vs. Clinical Execution (Permanent Doctrine):**
   *Representing a clinical calculation is structural. Executing a clinical calculation is clinical semantics.*
   A calculation definition may not execute until its approved version and human clinical sign-off are verified.
   Presence of complete component observations alone cannot activate formula execution. Until the associated calculation definition receives `APPROVED WITH VERSION` and a verified human reviewer sign-off reference in the RA Clinical Decision Register, complete components produce an explicit `CALCULATION_NOT_ACTIVATED` result.

## Consequences
- **Positive:** Complete explainability and auditability for all disease-activity metrics.
- **Positive:** Eliminates dangerous silent data imputation.
- **Positive:** Strictly prevents software or AI agents from executing unapproved clinical formulas or asserting clinical interpretations without verified rheumatologist approval.
- **Negative:** Calculation pipelines must check both component availability (yielding `NOT_CALCULABLE` if incomplete) and clinical approval status (yielding `CALCULATION_NOT_ACTIVATED` if pending).
