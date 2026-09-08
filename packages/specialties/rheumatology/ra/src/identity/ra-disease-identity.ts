/**
 * @file RA Disease Identity & Diagnostic Assertions
 * @description Represents evidence-linked RA diagnostic assertions with epistemic certainty and temporal context.
 * Invariant: Never a simple boolean (hasRA = true).
 */

import type {
  AssertionValidity,
  ClinicalTime,
  EvidenceId,
  TypedConceptReference,
} from "@sovereign/domain";

export enum RaDiagnosticCertainty {
  CONFIRMED = "CONFIRMED", // Explicitly verified rheumatologist diagnosis
  PROVISIONAL = "PROVISIONAL", // Suspected or working diagnosis
  DIFFERENTIAL = "DIFFERENTIAL", // One of multiple considered diagnoses
  RULED_OUT = "RULED_OUT", // Formally excluded
  UNKNOWN = "UNKNOWN", // Unspecified certainty in source record
}

export interface RaDiseaseIdentityAssertion {
  readonly assertionId: string;
  readonly conditionConcept: TypedConceptReference;
  readonly diagnosticCertainty: RaDiagnosticCertainty;
  readonly onsetTime: ClinicalTime;
  readonly diagnosisTime: ClinicalTime;
  readonly validity: AssertionValidity;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
