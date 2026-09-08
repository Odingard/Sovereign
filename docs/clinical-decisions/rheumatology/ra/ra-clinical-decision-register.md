# RA Clinical Decision Register — Adult Rheumatoid Arthritis

## Governance Status: AUTHORITATIVE CLINICAL DECISION REGISTER
### Responsible Authority: RA Clinical Safety Owner (Practicing Adult Rheumatologist)
### Current Revision: V0.2 — All Entries PENDING RHEUMATOLOGY REVIEW

> [!IMPORTANT]
> **Permanent Clinical Governance Doctrine:**
> 1. **Sovereign will never be the doctor.** The clinician decides; Sovereign makes the decision executable.
> 2. Clinical ambiguity must be marked `REQUIRES CLINICAL DECISION`, not guessed.
> 3. An AI agent, LLM, or automated software system may **NEVER** approve, resolve, or close a `REQUIRES_CLINICAL_DECISION` entry.
> 4. Runtime clinical logic may consume **ONLY** rules that have achieved status: `APPROVED WITH VERSION` accompanied by a verified human rheumatologist sign-off reference.
> 5. All entries lacking explicit clinical approval remain strictly **STRUCTURAL ONLY / NON-INTERPRETED**.
> 6. **Representing a clinical calculation is structural. Executing a clinical calculation is clinical semantics.** A calculation definition may not execute until its approved version and human clinical sign-off are verified.
> 7. **Formula Approval is distinct from Interpretation Threshold Approval.** A calculation formula definition (component weighting, math, rounding, required components) and categorical cutoffs (e.g. Remission vs Low vs High) are separate clinical governance decisions. Neither may execute without its own explicit approved version and verified human clinician sign-off.

---

## 1. Register Schema & Review Requirements

Every clinical decision entry tracks 11 required governance fields:
- **Decision ID:** Stable identifier (`CDR-RA-XXX`).
- **Clinical Governance Question:** Precise clinical policy or semantics question.
- **Clinical Risk if Incorrect:** Specific patient safety or diagnostic hazard resulting from erroneous logic.
- **Candidate Options:** Clinically sound candidate standards or thresholds proposed for specialist review.
- **Authoritative Source / Evidence References:** Formal peer-reviewed literature, consensus guidelines, or trial evidence.
- **Responsible Reviewer:** Designated clinical specialist (`RA Clinical Safety Owner`).
- **Review Status:** `PENDING_RHEUMATOLOGY_REVIEW`, `APPROVED WITH VERSION`, or `REJECTED`.
- **Decision Date:** Date of human clinician sign-off (or `Pending`).
- **Approval Reference:** Durable identifier of clinician review record.
- **Approved Definition / Rule Version:** Specific version activated for runtime logic (or `None (Structural Only)`).
- **Product Version Affected:** Target software milestone (e.g. `V0.1`).

---

## 2. Active Clinical Decisions Register

| Decision ID | Clinical Governance Question | Clinical Risk if Incorrect | Candidate Options | Authoritative Source / Evidence References | Responsible Reviewer | Review Status | Decision Date | Approval Reference | Approved Version | Product Version Affected |
|---|---|---|---|---|---|---|---|---|---|---|
| **CDR-RA-001A**<br>*(Formula Approval)* | What is the approved mathematical formula, component requirements, scaling, and rounding for calculating the Clinical Disease Activity Index (CDAI) numeric score? | Computational or weighting errors producing false scores, leading to inappropriate escalation or de-escalation of immunosuppressive therapy. | Mathematical candidate: $\text{CDAI} = \text{TJC28} + \text{SJC28} + \text{PtGA (0-10)} + \text{PhGA (0-10)}$. Range 0–76. Single-decimal rounding. Mandatory presence of all 4 components (no imputation). | Smolen JS, et al. Arthritis Res Ther. 2005; Aletaha D, et al. Clin Exp Rheumatol. 2005. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only / Calculation Not Activated) | V0.1 |
| **CDR-RA-001B**<br>*(Threshold Approval)* | What are the approved numerical cutoffs for Clinical Disease Activity Index (CDAI) categories (Remission, Low, Moderate, High Disease Activity)? | Misclassifying disease activity (e.g. high as low prevents therapy escalation; remission as active causes overtreatment). | ACR 2005 / Smolen 2007 cutoffs: $\le 2.8$ Remission, $>2.8$ and $\le 10.0$ Low, $>10.0$ and $\le 22.0$ Moderate, $>22.0$ High. | Smolen JS, et al. Arthritis Res Ther. 2005; Aletaha D, et al. Clin Exp Rheumatol. 2005. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only / Non-Interpreted) | V0.1 |
| **CDR-RA-002A**<br>*(Formula Approval)* | What are the approved mathematical formulas, weighting factors, and laboratory components for calculating Simplified Disease Activity Index (SDAI) and Disease Activity Score 28 (DAS28-ESR, DAS28-CRP)? | Formula errors leading to erroneous composite score calculation and inappropriate biologic or targeted therapy authorization. | Standard mathematical definitions: $\text{SDAI} = \text{TJC28} + \text{SJC28} + \text{PtGA} + \text{PhGA} + \text{CRP (mg/dL)}$; $\text{DAS28-ESR} = 0.56\sqrt{\text{TJC28}} + 0.28\sqrt{\text{SJC28}} + 0.70\ln(\text{ESR}) + 0.014(\text{PtGA})$. Requires all constituent components. | Prevoo ML, et al. Arthritis Rheum. 1995; Smolen JS, et al. Rheumatology. 2003. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only / Calculation Not Activated) | V0.1 |
| **CDR-RA-002B**<br>*(Threshold Approval)* | What are the approved numerical cutoffs for SDAI and DAS28-ESR/CRP categorical interpretation (Remission, Low, Moderate, High)? | Inappropriate biologic escalation, step-therapy failure misattribution, or toxic overtreatment. | EULAR/ACR threshold tables (e.g. DAS28-ESR $<2.6$ Remission, $\le 3.2$ Low, $\le 5.1$ Moderate, $>5.1$ High; SDAI $\le 3.3$ Remission, $\le 11$ Low, $\le 26$ Moderate, $>26$ High). | Prevoo ML, et al. Arthritis Rheum. 1995; Smolen JS, et al. Rheumatology. 2003. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only / Non-Interpreted) | V0.1 |
| **CDR-RA-003** | What defines the minimum adequate dose and duration of oral/subQ methotrexate to declare "therapeutic failure" (inadequate response)? | Prematurely declaring MTX failure before reaching therapeutic dose (e.g. 15mg vs 20-25mg for $\ge 12$ weeks), disqualifying valid step-therapy. | Candidate: $\ge 15\text{ mg/wk}$ for $\ge 12\text{ wks}$ (or $\ge 20\text{ mg/wk}$ unless limited by documented intolerance). | 2021 ACR Guideline for the Treatment of Rheumatoid Arthritis. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only) | V0.1 |
| **CDR-RA-004** | How should discordant joint counts (clinician physical exam vs musculoskeletal ultrasound) be reconciled? | Overtreatment of subclinical changes or missing active synovitis with structural progression risk. | Maintain dual assertions as `CONFLICTED` pending clinician exam reconciliation; no automated overwrite. | Backhaus M, et al. Arthritis Rheum. 1999; Colebatch AN, et al. Ann Rheum Dis. 2013. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only) | V0.1 |
| **CDR-RA-005** | Which extra-articular manifestations belong in P0 core state vs P1 extended candidate scope? | Missing life-threatening systemic complications (ILD, vasculitis) vs data entry burden and misclassification. | **P0 Candidates:** Rheumatoid Nodules, RA-ILD, Vasculitis, Scleritis.<br>**P1 Candidates:** Secondary Sjögren's, Felty syndrome, Pleuritis. | Turesson C, et al. Ann Rheum Dis. 2003; Bongartz T, et al. Arthritis Rheum. 2010. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only) | V0.1 |
| **CDR-RA-006** | Which serologic and inflammatory laboratory tests belong in P0 core state vs P1 extended? | Incomplete disease characterization or ordering unnecessary tests. | **P0 Candidates:** RF (titer & qualitative), anti-CCP (titer & qualitative), ESR, CRP.<br>**P1 Candidates:** ANA, HLA-B27, Vectra DA. | 2010 ACR/EULAR Classification Criteria for RA. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only) | V0.1 |
| **CDR-RA-007** | Which imaging modalities and anatomical findings belong in P0 core state? | Failure to capture structural joint progression. | **P0 Candidates:** Plain radiographs of hands/wrists/feet (erosions, joint space narrowing).<br>**P1 Candidates:** Power Doppler ultrasound, MRI. | van der Heijde D. Rheum Dis Clin North Am. 2000; Sharp JT, et al. Arthritis Rheum. 1985. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only) | V0.1 |
| **CDR-RA-008** | What clinical laboratory thresholds define acute toxicity warranting DMARD hold or discontinuation? | Liver failure / sepsis progression vs unnecessary medication withdrawal for benign transient fluctuations. | Candidate criteria: ALT/AST $>3\times$ ULN; ANC $<1000/\mu\text{L}$; Platelets $<50,000/\mu\text{L}$. | ACR DMARD Monitoring Recommendations. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only) | V0.1 |
| **CDR-RA-009** | Which RxNorm to Sovereign medication mappings require specialist verification? | Dispensing or querying incorrect formulation (e.g. oral vs subcutaneous methotrexate). | Specialty pharmacy cross-walk audit table. | RxNorm 2024AB / Sovereign Concept Mapping Table V1. | RA Clinical Safety Owner | `PENDING_RHEUMATOLOGY_REVIEW` | Pending | Pending | None (Structural Only) | V0.1 |

---

## 3. Operational Rules for Runtime Software

1. **Gate Guard:** If a domain function or projection requires a value or formula from this register whose status is `PENDING_RHEUMATOLOGY_REVIEW`, the software **MUST**:
   - **For Unapproved Formulas (`FORMULA APPROVAL`):** return an explicit `CALCULATION_NOT_ACTIVATED` result (or `NOT_CALCULABLE` if components are missing). The software **MUST NOT** execute unapproved mathematical formulas to produce numeric scores.
   - **For Unapproved Thresholds (`INTERPRETATION THRESHOLD APPROVAL`):** leave `approvedInterpretation` as `undefined` and mark the interpretation field as `REQUIRES_CLINICAL_DECISION`.
   - **Refrain** from triggering downstream clinical actions, holds, or execution graph nodes.
2. **Audit Requirement:** When an approved version is activated, the audit log must record the exact `Approval Reference` and `Approved Version`.
