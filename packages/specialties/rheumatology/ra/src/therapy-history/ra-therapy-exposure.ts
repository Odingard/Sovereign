/**
 * @file RA Therapy Exposure Record
 * @description Invariant: Represents actual physical or administration exposure facts.
 * Does NOT own a mandatory outcome. Exposure != response.
 */

import type {
  ClinicalTime,
  EvidenceId,
  TypedConceptReference,
  TypedValueQuantity,
} from "@sovereign/domain";
import type { RaMedicationCategory } from "../concepts/ra-medication-classes.js";
import type { TherapyLifecycleStatus } from "./ra-therapy-status.js";

export interface RaTherapyExposure {
  readonly exposureId: string;
  readonly medicationConcept: TypedConceptReference;
  readonly medicationCategory: RaMedicationCategory;
  readonly route?: "ORAL" | "SUBCUTANEOUS" | "INTRAVENOUS" | "INTRAMUSCULAR" | "UNKNOWN";
  readonly maximumDose?: TypedValueQuantity;
  readonly exposurePeriod: {
    readonly startTime: ClinicalTime; // Supports APPROXIMATE or YEAR_ONLY without manufacturing precision
    readonly stopTime?: ClinicalTime;
  };
  readonly lifecycleStatus: TherapyLifecycleStatus;
  readonly exposureEvidenceIds: ReadonlyArray<EvidenceId>;
}
