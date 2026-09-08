/**
 * @file RA Observed Monitoring Facts
 * @description Invariant: Represents factual observations only.
 * Stripped of all policy conclusions (no CLEARED_NEGATIVE, POSITIVE_REQUIRES_ACTION, or freshness evaluations).
 */

import type {
  ClinicalTime,
  EvidenceId,
  TypedConceptReference,
  TypedValueQuantity,
} from "@sovereign/domain";
import type { RaLaboratoryTestCategory } from "../concepts/ra-laboratory-concepts.js";

export interface RaObservedMonitoringFact {
  readonly assertionId: string;
  readonly testConcept: TypedConceptReference;
  readonly category: RaLaboratoryTestCategory;
  readonly qualitativeResult?:
    | "POSITIVE"
    | "NEGATIVE"
    | "REACTIVE"
    | "NON_REACTIVE"
    | "INDETERMINATE";
  readonly quantitativeValue?: TypedValueQuantity;
  readonly sourceReferenceRange?: string;
  readonly collectionTime: ClinicalTime;
  readonly supportingEvidenceId: EvidenceId;
}
