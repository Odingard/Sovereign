/**
 * @file RA Therapy Discontinuation Events & Reasons
 * @description Invariants: Stopped != failed. Stopped != reason known.
 * Every discontinuation reason strictly requires explicit supporting evidence.
 */

import type { ClinicalTime, EvidenceId } from "@sovereign/domain";

export enum RaDiscontinuationReasonCategory {
  INADEQUATE_RESPONSE = "INADEQUATE_RESPONSE",
  ADVERSE_EVENT_OR_INTOLERANCE = "ADVERSE_EVENT_OR_INTOLERANCE",
  PATIENT_PREFERENCE_OR_DECLINED = "PATIENT_PREFERENCE_OR_DECLINED",
  FINANCIAL_OR_INSURANCE_ACCESS_BARRIER = "FINANCIAL_OR_INSURANCE_ACCESS_BARRIER",
  REMISSION_TAPERING = "REMISSION_TAPERING",
  UNKNOWN_REASON = "UNKNOWN_REASON",
}

export interface RaTherapyDiscontinuationEvent {
  readonly eventId: string;
  readonly exposureId: string;
  readonly stopTime: ClinicalTime;
  readonly cessationEvidenceId: EvidenceId;
}

export interface RaTherapyDiscontinuationReason {
  readonly reasonId: string;
  readonly exposureId: string;
  readonly discontinuationEventId: string;
  readonly typedReason: RaDiscontinuationReasonCategory;
  readonly supplementalNote?: string; // Human-readable annotation; NOT deterministic logic
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>; // Mandatory evidence
}
