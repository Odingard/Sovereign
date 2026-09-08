/**
 * @file Disease Activity Score Derivation Engine & Provenance Pipeline
 * @description Invariant (ADR-0012): Strict four-stage derivation with explicit NOT_CALCULABLE handling.
 * Unapproved formulas and categorical thresholds remain disabled/structural only.
 */

import type { RaDiseaseActivityScoreResult } from "./ra-structural-measures.js";

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

/**
 * Derives CDAI score structurally.
 * Invariant: If any component is undefined, produces NOT_CALCULABLE. Never imputes default values.
 */
export function deriveStructuralCdai(inputs: CdaiComponentInputs): RaDiseaseActivityScoreResult {
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

  if (missing.length > 0) {
    return {
      status: "NOT_CALCULABLE",
      missingComponents: missing,
      availableComponentAssertionIds: availableIds,
      reason: "MISSING_MANDATORY_COMPONENTS",
    };
  }

  // All 4 components confirmed present
  const score = inputs.tjc28Value! + inputs.sjc28Value! + inputs.ptgaValue! + inputs.phgaValue!;

  return {
    status: "CALCULATED",
    numericValue: Number(score.toFixed(1)),
    calculationDefinitionId: "DEF-CDAI-ACR-2005",
    calculationVersion: "1.0.0-structural",
    calculatedAt: new Date(),
    sourceComponentAssertionIds: availableIds,
    // Categorical interpretation withheld pending clinical approval in RA Clinical Decision Register
    approvedInterpretation: undefined,
  };
}
