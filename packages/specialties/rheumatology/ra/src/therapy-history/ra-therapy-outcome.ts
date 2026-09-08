/**
 * @file RA Therapy Outcome Assertion
 * @description Invariant: Time-bounded outcome assertions linked to exposure.
 * Supports multiple outcomes over time (e.g. initial response followed by secondary loss of response).
 */

import type { AssertionValidity, ClinicalTime, EvidenceId } from "@sovereign/domain";

export enum RaTherapyOutcomeKind {
  INITIAL_RESPONSE_ACHIEVED = "INITIAL_RESPONSE_ACHIEVED",
  INADEQUATE_RESPONSE_PRIMARY = "INADEQUATE_RESPONSE_PRIMARY",
  INADEQUATE_RESPONSE_SECONDARY = "INADEQUATE_RESPONSE_SECONDARY", // Secondary loss of response
  INTOLERANCE_OR_ADVERSE_EVENT = "INTOLERANCE_OR_ADVERSE_EVENT",
  CONTRAINDICATION_IDENTIFIED = "CONTRAINDICATION_IDENTIFIED",
  REMISSION_ACHIEVED_TAPERING = "REMISSION_ACHIEVED_TAPERING",
  UNKNOWN_OUTCOME = "UNKNOWN_OUTCOME",
}

export interface RaTherapyOutcomeAssertion {
  readonly outcomeAssertionId: string;
  readonly exposureId: string;
  readonly outcomeKind: RaTherapyOutcomeKind;
  readonly effectiveTimeWindow: ClinicalTime;
  readonly validity: AssertionValidity;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
