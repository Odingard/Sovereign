/**
 * @file RA Epistemic Reconciliation & Conflict Management
 * @description Represents contradictory assertions concurrently with CONFLICTED status.
 * Invariant: AI and automated services are forbidden from silently resolving clinical contradictions.
 */

import { type ClinicalAssertion, EpistemicStatus } from "@sovereign/domain";
import { type RaUnresolvedIssue, RaUnresolvedIssueKind } from "./ra-unresolved-issue.js";

export function detectAssertionConflict(
  assertionA: ClinicalAssertion,
  assertionB: ClinicalAssertion,
  issueDescription: string,
): RaUnresolvedIssue | null {
  if (
    assertionA.validity.status === EpistemicStatus.CONFLICTED ||
    assertionB.validity.status === EpistemicStatus.CONFLICTED
  ) {
    const evidenceIds = [...assertionA.supportingEvidenceIds, ...assertionB.supportingEvidenceIds];

    return {
      issueId: `conflict-${assertionA.assertionId}-${assertionB.assertionId}`,
      issueKind: RaUnresolvedIssueKind.CONFLICTING_EVIDENCE_REQUIRING_CLINICIAN_REVIEW,
      description: issueDescription,
      conflictingAssertionIds: [assertionA.assertionId, assertionB.assertionId],
      conflictingEvidenceIds: evidenceIds,
      requiresClinicianReview: true,
    };
  }

  return null;
}
