/**
 * @file Structural Disease Activity Measure Contracts
 * @description Invariant (ADR-0012): Separates primary observations, deterministic calculations, and interpretations.
 * Permanent Doctrine:
 * 1. Representing a clinical calculation is structural. Executing a clinical calculation is clinical semantics.
 * 2. A calculation definition may not execute until its approved version and human clinical sign-off are verified.
 * 3. Produces explicit NOT_CALCULABLE state when mandatory components are missing.
 * 4. Produces explicit CALCULATION_NOT_ACTIVATED state when calculation formula is pending clinical approval.
 */

import type { ClinicalTime, EvidenceId } from "@sovereign/domain";
import type { ClinicalDecisionReviewStatus } from "../register/ra-clinical-decision-types.js";

export type RaDiseaseActivityScoreResult =
  | {
      readonly status: "CALCULATED";
      readonly numericValue: number;
      readonly calculationDefinitionId: string;
      readonly calculationVersion: string;
      readonly clinicalDecisionId: string;
      readonly humanReviewerSignOffReference: string;
      readonly calculatedAt: Date;
      readonly sourceComponentAssertionIds: ReadonlyArray<string>;
      readonly approvedInterpretation?: {
        readonly categoryName: string;
        readonly approvalRecordId: string;
      };
    }
  | {
      readonly status: "NOT_CALCULABLE";
      readonly missingComponents: ReadonlyArray<string>;
      readonly availableComponentAssertionIds: ReadonlyArray<string>;
      readonly reason: "MISSING_MANDATORY_COMPONENTS";
    }
  | {
      readonly status: "CALCULATION_NOT_ACTIVATED";
      readonly calculationDefinitionId: string;
      readonly clinicalDecisionId: string;
      readonly reviewStatus: ClinicalDecisionReviewStatus;
      readonly candidateFormulaMetadata: {
        readonly formulaName: string;
        readonly candidateVersion: string;
        readonly componentRequirements: ReadonlyArray<string>;
      };
      readonly availableComponentAssertionIds: ReadonlyArray<string>;
      readonly reason: "REQUIRES_CLINICAL_APPROVAL";
      readonly explanation: string;
    };

export enum StandardizedMeasureType {
  CDAI = "CDAI",
  SDAI = "SDAI",
  DAS28_ESR = "DAS28_ESR",
  DAS28_CRP = "DAS28_CRP",
}

export interface RaCalculationDefinition {
  readonly calculationDefinitionId: string;
  readonly clinicalDecisionId: string;
  readonly measureType: StandardizedMeasureType;
  readonly formulaName: string;
  readonly componentRequirements: ReadonlyArray<string>;
  readonly candidateVersion: string;
  readonly reviewStatus: ClinicalDecisionReviewStatus;
  readonly approvedVersion?: string;
  readonly humanReviewerSignOffReference?: string;
  readonly decisionDate?: Date;
}

export interface RaStandardizedMeasureRecord {
  readonly recordId: string;
  readonly measureType: StandardizedMeasureType;
  readonly scoreResult: RaDiseaseActivityScoreResult;
  readonly effectiveTime: ClinicalTime;
  readonly sourceEvidenceIds: ReadonlyArray<EvidenceId>;
  readonly requiresClinicalDecision: boolean;
}
