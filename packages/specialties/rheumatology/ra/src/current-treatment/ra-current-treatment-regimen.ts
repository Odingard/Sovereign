/**
 * @file RA Current Treatment Regimen
 * @description Represents active disease-directed medications and regimen classification.
 */

import type {
  ClinicalTime,
  EvidenceId,
  TypedConceptReference,
  TypedValueQuantity,
} from "@sovereign/domain";
import type { RaMedicationCategory } from "../concepts/ra-medication-classes.js";

export enum RegimenClassification {
  MONOTHERAPY = "MONOTHERAPY",
  COMBINATION_DMARD = "COMBINATION_DMARD",
  TRIPLE_THERAPY = "TRIPLE_THERAPY",
  NO_ACTIVE_DMARD = "NO_ACTIVE_DMARD",
  UNKNOWN = "UNKNOWN",
}

export interface ActiveTherapyItem {
  readonly medicationConcept: TypedConceptReference;
  readonly category: RaMedicationCategory;
  readonly currentDose: TypedValueQuantity;
  readonly scheduleDescription?: string;
  readonly initiatedTime: ClinicalTime;
}

export interface RaCurrentTreatmentRegimen {
  readonly activeTherapies: ReadonlyArray<ActiveTherapyItem>;
  readonly classification: RegimenClassification;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
