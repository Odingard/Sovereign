/**
 * @file RA Unresolved Clinical Issues
 * @description Models clinically meaningful gaps, pending tests, and conflicting evidence requiring specialist review.
 */

import type { EvidenceId } from "@sovereign/domain";

export enum RaUnresolvedIssueKind {
  PENDING_DIAGNOSTIC_EVIDENCE = "PENDING_DIAGNOSTIC_EVIDENCE",
  CONFLICTING_EVIDENCE_REQUIRING_CLINICIAN_REVIEW = "CONFLICTING_EVIDENCE_REQUIRING_CLINICIAN_REVIEW",
  INCOMPLETE_HISTORICAL_THERAPY_RECORD = "INCOMPLETE_HISTORICAL_THERAPY_RECORD",
  UNCERTAIN_DISEASE_ACTIVITY = "UNCERTAIN_DISEASE_ACTIVITY",
  UNRESOLVED_SAFETY_SCREENING = "UNRESOLVED_SAFETY_SCREENING",
}

export interface RaUnresolvedIssue {
  readonly issueId: string;
  readonly issueKind: RaUnresolvedIssueKind;
  readonly description: string;
  readonly conflictingAssertionIds?: ReadonlyArray<string>;
  readonly conflictingEvidenceIds?: ReadonlyArray<EvidenceId>;
  readonly requiresClinicianReview: true;
}
