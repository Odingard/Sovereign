/**
 * @file Structural Disease Activity Measure Contracts
 * @description Invariant (ADR-0012): Separates primary observations, deterministic calculations, and interpretations.
 * Produces explicit NOT_CALCULABLE state when mandatory components are missing.
 */

import type { ClinicalTime, EvidenceId } from "@sovereign/domain";

export type RaDiseaseActivityScoreResult =
  | {
      readonly status: "CALCULATED";
      readonly numericValue: number;
      readonly calculationDefinitionId: string;
      readonly calculationVersion: string;
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
    };

export enum StandardizedMeasureType {
  CDAI = "CDAI",
  SDAI = "SDAI",
  DAS28_ESR = "DAS28_ESR",
  DAS28_CRP = "DAS28_CRP",
}

export interface RaStandardizedMeasureRecord {
  readonly recordId: string;
  readonly measureType: StandardizedMeasureType;
  readonly scoreResult: RaDiseaseActivityScoreResult;
  readonly effectiveTime: ClinicalTime;
  readonly sourceEvidenceIds: ReadonlyArray<EvidenceId>;
  readonly requiresClinicalDecision: boolean;
}
