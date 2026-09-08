/**
 * @file RA Global Assessments (PtGA & PhGA)
 * @description Patient Global and Physician Global visual analogue scale (VAS) observations.
 */

import type { ClinicalTime, EvidenceId } from "@sovereign/domain";

export enum GlobalAssessmentKind {
  PATIENT_GLOBAL_PTGA = "PATIENT_GLOBAL_PTGA",
  PHYSICIAN_GLOBAL_PHGA = "PHYSICIAN_GLOBAL_PHGA",
}

export enum VisualAnalogueScaleUnit {
  VAS_0_10 = "VAS_0_10",
  VAS_0_100 = "VAS_0_100",
}

export interface RaGlobalObservation {
  readonly observationId: string;
  readonly kind: GlobalAssessmentKind;
  readonly scale: VisualAnalogueScaleUnit;
  readonly numericScore: number;
  readonly observationTime: ClinicalTime;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
