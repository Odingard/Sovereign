/**
 * @file Disease Activity Score Derivation Engine & Provenance Pipeline
 * @description Invariant (ADR-0012): Strict multi-stage derivation with explicit NOT_CALCULABLE and
 * CALCULATION_NOT_ACTIVATED handling.
 * Permanent Doctrine:
 * 1. Representing a clinical calculation is structural. Executing a clinical calculation is clinical semantics.
 * 2. A calculation definition may not execute until its approved version and human clinical sign-off are verified.
 * 3. Unapproved formulas and categorical thresholds remain disabled/structural only.
 */

import { ClinicalDecisionReviewStatus } from "../register/ra-clinical-decision-types.js";
import {
  type RaCalculationDefinition,
  type RaDiseaseActivityScoreResult,
  StandardizedMeasureType,
} from "./ra-structural-measures.js";

export interface CdaiComponentInputs {
  readonly tjc28AssertionId?: string;
  readonly tjc28Value?: number;
  readonly sjc28AssertionId?: string;
  readonly sjc28Value?: number;
  readonly ptgaAssertionId?: string;
  readonly ptgaValue?: number; // Expected 0-10 scale
  readonly phgaAssertionId?: string;
  readonly phgaValue?: number; // Expected 0-10 scale
}

export const STRUCTURAL_CDAI_CALCULATION_DEFINITION: RaCalculationDefinition = {
  calculationDefinitionId: "DEF-CDAI-ACR-2005",
  clinicalDecisionId: "CDR-RA-001A",
  measureType: StandardizedMeasureType.CDAI,
  formulaName: "CDAI (TJC28 + SJC28 + PtGA + PhGA)",
  componentRequirements: [
    "TENDER_JOINT_COUNT_28",
    "SWOLLEN_JOINT_COUNT_28",
    "PATIENT_GLOBAL_PTGA",
    "PHYSICIAN_GLOBAL_PHGA",
  ],
  candidateVersion: "1.0.0-candidate",
  reviewStatus: ClinicalDecisionReviewStatus.PENDING_RHEUMATOLOGY_REVIEW,
  // Note: approvedVersion and humanReviewerSignOffReference are strictly undefined.
  // Clinical approval is pending in the RA Clinical Decision Register (CDR-RA-001A).
};

/**
 * Derives CDAI score structurally.
 * Invariants (ADR-0012):
 * 1. If any component is missing, produces NOT_CALCULABLE. Never imputes default values.
 * 2. If all components are present but formula is unapproved, produces CALCULATION_NOT_ACTIVATED.
 * 3. Produces CALCULATED only if definition has APPROVED_WITH_VERSION, approvedVersion, and humanReviewerSignOffReference.
 */
export function deriveStructuralCdai(
  inputs: CdaiComponentInputs,
  definition: RaCalculationDefinition = STRUCTURAL_CDAI_CALCULATION_DEFINITION,
): RaDiseaseActivityScoreResult {
  const missing: string[] = [];
  const availableIds: string[] = [];

  if (inputs.tjc28AssertionId && inputs.tjc28Value !== undefined) {
    availableIds.push(inputs.tjc28AssertionId);
  } else {
    missing.push("TENDER_JOINT_COUNT_28");
  }

  if (inputs.sjc28AssertionId && inputs.sjc28Value !== undefined) {
    availableIds.push(inputs.sjc28AssertionId);
  } else {
    missing.push("SWOLLEN_JOINT_COUNT_28");
  }

  if (inputs.ptgaAssertionId && inputs.ptgaValue !== undefined) {
    availableIds.push(inputs.ptgaAssertionId);
  } else {
    missing.push("PATIENT_GLOBAL_PTGA");
  }

  if (inputs.phgaAssertionId && inputs.phgaValue !== undefined) {
    availableIds.push(inputs.phgaAssertionId);
  } else {
    missing.push("PHYSICIAN_GLOBAL_PHGA");
  }

  // Stage 1: Missing component validation. ADR-0012: Never impute missing components.
  if (missing.length > 0) {
    return {
      status: "NOT_CALCULABLE",
      missingComponents: missing,
      availableComponentAssertionIds: availableIds,
      reason: "MISSING_MANDATORY_COMPONENTS",
    };
  }

  // Stage 2: Formula activation governance check.
  // Permanent Doctrine: Representing a clinical calculation is structural. Executing a clinical calculation is clinical semantics.
  // A calculation definition may not execute until its approved version and human clinical sign-off are verified.
  const approvedVersion = definition.approvedVersion;
  const humanSignOff = definition.humanReviewerSignOffReference;
  const isApproved =
    definition.reviewStatus === ClinicalDecisionReviewStatus.APPROVED_WITH_VERSION &&
    approvedVersion !== undefined &&
    humanSignOff !== undefined &&
    !isAiSignOff(humanSignOff);

  if (
    !isApproved ||
    approvedVersion === undefined ||
    humanSignOff === undefined ||
    inputs.tjc28Value === undefined ||
    inputs.sjc28Value === undefined ||
    inputs.ptgaValue === undefined ||
    inputs.phgaValue === undefined
  ) {
    return {
      status: "CALCULATION_NOT_ACTIVATED",
      calculationDefinitionId: definition.calculationDefinitionId,
      clinicalDecisionId: definition.clinicalDecisionId,
      reviewStatus: definition.reviewStatus,
      candidateFormulaMetadata: {
        formulaName: definition.formulaName,
        candidateVersion: definition.candidateVersion,
        componentRequirements: definition.componentRequirements,
      },
      availableComponentAssertionIds: availableIds,
      reason: "REQUIRES_CLINICAL_APPROVAL",
      explanation:
        "Representing a clinical calculation is structural. Executing a clinical calculation is clinical semantics. A calculation definition may not execute until its approved version and human clinical sign-off are verified.",
    };
  }

  // Stage 3: Deterministic calculation (Only when human clinical approval is verified)
  const score = inputs.tjc28Value + inputs.sjc28Value + inputs.ptgaValue + inputs.phgaValue;

  return {
    status: "CALCULATED",
    numericValue: Number(score.toFixed(1)),
    calculationDefinitionId: definition.calculationDefinitionId,
    calculationVersion: approvedVersion,
    clinicalDecisionId: definition.clinicalDecisionId,
    humanReviewerSignOffReference: humanSignOff,
    calculatedAt: new Date(),
    sourceComponentAssertionIds: availableIds,
    // Categorical interpretation withheld pending clinical approval in RA Clinical Decision Register (CDR-RA-001B)
    approvedInterpretation: undefined,
  };
}

function isAiSignOff(reference?: string): boolean {
  if (!reference) return false;
  const lower = reference.toLowerCase();
  return (
    lower.includes("ai") ||
    lower.includes("model") ||
    lower.includes("bot") ||
    lower.includes("llm") ||
    lower.includes("agent")
  );
}
