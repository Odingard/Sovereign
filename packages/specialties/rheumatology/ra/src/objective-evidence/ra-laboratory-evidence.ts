/**
 * @file RA Laboratory Evidence Assertions
 * @description Links objective laboratory test facts to immutable ClinicalEvidenceAggregate objects.
 */

import type {
  ClinicalTime,
  EvidenceId,
  TypedConceptReference,
  TypedValueQuantity,
} from "@sovereign/domain";
import type { RaLaboratoryTestCategory } from "../concepts/ra-laboratory-concepts.js";

export interface RaLaboratoryAssertion {
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
  readonly collectionTime: ClinicalTime;
  readonly supportingEvidenceId: EvidenceId;
}
